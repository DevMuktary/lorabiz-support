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

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, message, senderName, customerEmail, attachmentUrl, action, messageId, userId } = body;

    // NEW: API-Based Session Initialization
    if (action === 'INIT_SESSION') {
      if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
      try {
        // Find the most recent ticket for this user
        const activeTickets = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
          Query.equal('userId', userId),
          Query.orderDesc('$createdAt'),
          Query.limit(1)
        ]);

        if (activeTickets.documents.length > 0 && activeTickets.documents[0].status !== 'CLOSED') {
          const activeTicket = activeTickets.documents[0];
          const historyDocs = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
            Query.equal('ticketId', activeTicket.$id), Query.orderAsc('$createdAt'), Query.limit(100),
          ]);
          return NextResponse.json({ status: 'SUCCESS', ticketId: activeTicket.$id, messages: historyDocs.documents, ticketStatus: activeTicket.status });
        }
        return NextResponse.json({ status: 'NO_ACTIVE_TICKET' });
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
    }

    if (action === 'FETCH_HISTORY') {
      if (!ticketId) return NextResponse.json({ error: 'Missing ticketId' }, { status: 400 });
      try {
        const ticket = await databases.getDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId);
        const historyDocs = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
          Query.equal('ticketId', ticketId), Query.orderAsc('$createdAt'), Query.limit(100),
        ]);
        return NextResponse.json({ status: 'SUCCESS', messages: historyDocs.documents, ticketStatus: ticket.status });
      } catch (e: any) {
        if (e.code === 404) return NextResponse.json({ status: 'NOT_FOUND', messages: [] });
        throw e;
      }
    }

    if (!ticketId || !message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const sanitizedMessage = message.trim();
    const securePermissions = [
      Permission.read(Role.team('agents')),
      Permission.update(Role.team('agents')),
      Permission.delete(Role.team('agents'))
    ];

    let ticket;
    try {
      ticket = await databases.getDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId);
    } catch (e: any) {
      if (e.code === 404) {
        const generatedTitle = sanitizedMessage.includes('[System: Customer Onboarded]') 
          ? 'New Support Request' 
          : (sanitizedMessage.length > 30 ? sanitizedMessage.substring(0, 30) + '...' : sanitizedMessage);

        ticket = await databases.createDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId, {
            status: 'OPEN', 
            sourceChannel: 'IN_APP', 
            title: generatedTitle, 
            customerEmail: customerEmail || '',
            userId: userId || null // NEW: Save the User ID to the database
        }, securePermissions);
      } else {
        throw e; 
      }
    }

    if (ticket.status === 'CLOSED') return NextResponse.json({ error: 'Ticket closed.' }, { status: 400 });

    const isSystemOnboard = sanitizedMessage.includes('[System: Customer Onboarded]');
    const actualSenderType = isSystemOnboard ? 'SYSTEM' : 'CUSTOMER';
    const finalMessageId = messageId || ID.unique();

    await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, finalMessageId, {
        ticketId, senderType: actualSenderType, senderId: ticketId, senderName: senderName || 'Client',
        sourceChannel: 'IN_APP', content: sanitizedMessage, attachmentUrl: attachmentUrl || null 
    }, securePermissions);

    if (ticket.status === 'PENDING_AGENT' || ticket.status === 'IN_PROGRESS') {
      return NextResponse.json({ status: 'RECEIVED' });
    }

    const historyDocs = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
      Query.equal('ticketId', ticketId), Query.orderAsc('$createdAt'), Query.limit(50),
    ]);

    const formattedHistory = historyDocs.documents.map((doc) => ({
      senderType: doc.senderType, content: doc.content || '[Attachment]',
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
