import { NextResponse } from 'next/server';
import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';
import { processTicketWithAI } from '@/lib/ai';
import { summarizeChatForAgent } from '@/lib/ai-summarizer';
import { checkBusinessHours } from '@/lib/business-hours';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_SECRET_KEY || '');

const databases = new Databases(client);

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
const TICKETS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
const MESSAGES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';

const MAX_MESSAGE_LENGTH = 2000;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, message, senderId, senderName, attachmentUrl } = body;

    if (!ticketId || typeof ticketId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing ticketId' }, { status: 400 });
    }

    if (!senderId || typeof senderId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing senderId' }, { status: 400 });
    }

    const sanitizedMessage = message ? message.trim() : '';
    
    const securePermissions = [
      Permission.read(Role.user(senderId)), 
      Permission.read(Role.team('agents')), 
      Permission.update(Role.team('agents'))
    ];

    let ticket;
    try {
      ticket = await databases.getDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId);
    } catch (e: any) {
      if (e.code === 404) {
        // Simple AI Title logic: Grab the first 30 chars, or you can plug in an actual OpenAI call here
        const generatedTitle = sanitizedMessage 
          ? (sanitizedMessage.length > 30 ? sanitizedMessage.substring(0, 30) + '...' : sanitizedMessage)
          : 'New Support Request';

        ticket = await databases.createDocument(
          DATABASE_ID, 
          TICKETS_COLLECTION_ID, 
          ticketId, 
          {
            status: 'OPEN',
            sourceChannel: 'IN_APP',
            title: generatedTitle // Saving the generated title
          },
          securePermissions
        );
      } else {
        throw e; 
      }
    }

    if (ticket.status === 'CLOSED') {
      return NextResponse.json({ error: 'This ticket is closed. Please open a new inquiry.' }, { status: 400 });
    }

    // Save Customer Message (now supports attachmentUrl)
    await databases.createDocument(
      DATABASE_ID, 
      MESSAGES_COLLECTION_ID, 
      ID.unique(), 
      {
        ticketId,
        senderType: 'CUSTOMER',
        senderId: senderId,
        senderName: senderName || 'Client',
        sourceChannel: 'IN_APP',
        content: sanitizedMessage || '[Attachment Sent]',
        attachmentUrl: attachmentUrl || null 
      },
      securePermissions
    );

    if (ticket.status === 'PENDING_AGENT' || ticket.status === 'IN_PROGRESS') {
      return NextResponse.json({ status: 'RECEIVED', aiProcessed: false });
    }

    const historyDocs = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
      Query.equal('ticketId', ticketId), Query.orderAsc('$createdAt'), Query.limit(50),
    ]);

    const formattedHistory = historyDocs.documents.map((doc) => ({
      senderType: doc.senderType,
      content: doc.content || '[Attachment]',
    }));

    const aiResponse = await processTicketWithAI(ticketId, formattedHistory);

    if (aiResponse.includes('TRIGGER_HANDOVER')) {
      const hoursStatus = checkBusinessHours();
      const transcript = formattedHistory.map((m) => `${m.senderType}: ${m.content}`).join('\n');
      const summary = await summarizeChatForAgent(transcript);

      const handoverMessage = hoursStatus.isOnline
        ? 'I have added you to our support queue. A human agent will connect with you shortly.'
        : hoursStatus.message;

      await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId, {
        status: 'PENDING_AGENT', aiSummary: summary,
      });

      await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, ID.unique(), {
        ticketId, senderType: 'SYSTEM', senderId: 'LORA_SYSTEM', senderName: 'System',
        sourceChannel: 'IN_APP', content: handoverMessage,
      }, securePermissions);

      return NextResponse.json({ status: 'HANDOVER_INITIATED', reply: handoverMessage });
    }

    await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, ID.unique(), {
      ticketId, senderType: 'ASSISTANT', senderId: 'LORA_BOT', senderName: 'Lora',
      sourceChannel: 'IN_APP', content: aiResponse,
    }, securePermissions);

    return NextResponse.json({ status: 'SUCCESS', reply: aiResponse });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
