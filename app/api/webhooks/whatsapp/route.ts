import { NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';
import { processTicketWithAI } from '@/lib/ai';
import { checkBusinessHours } from '@/lib/business-hours';
import { summarizeChatForAgent } from '@/lib/ai-summarizer';

const adminClient = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_SECRET_KEY!);

const databases = new Databases(adminClient);

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;
const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID!;

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("hub.mode") === "subscribe") {
    return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("Webhook Active", { status: 200 });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const message = entry?.changes?.[0]?.value?.messages?.[0];
      const contact = entry?.changes?.[0]?.value?.contacts?.[0];

      if (message) {
        const customerPhone = message.from;
        const customerName = contact?.profile?.name || 'Customer';
        
        let content = '';

        if (message.type === 'image' || message.type === 'document') {
          content = '[Attachment Received]';
        } else if (message.type === 'interactive') {
           // We no longer send interactive buttons, but we handle it just in case
           content = message.interactive.button_reply?.title || '[Interactive Response]';
        } else {
          content = message.text?.body || '';
        }

        const existingTickets = await databases.listDocuments(dbId, ticketsCol, [
          Query.equal('customerPhone', customerPhone),
          Query.notEqual('status', 'CLOSED'),
          Query.orderDesc('$createdAt'),
          Query.limit(1)
        ]);

        let ticketId = '';
        let currentStatus = 'OPEN';

        if (existingTickets.documents.length > 0) {
          ticketId = existingTickets.documents[0].$id;
          currentStatus = existingTickets.documents[0].status;
          await databases.updateDocument(dbId, ticketsCol, ticketId, { 
            lastMessage: content
          });
        } else {
          const newTicket = await databases.createDocument(dbId, ticketsCol, ID.unique(), {
            customerPhone: customerPhone,
            sourceChannel: 'WHATSAPP',
            status: 'OPEN',
            lastMessage: content
          });
          ticketId = newTicket.$id;
        }

        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId,
          senderType: 'CUSTOMER',
          senderName: customerName,
          content,
        });

        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const metaToken = process.env.WHATSAPP_TOKEN;

        // If the ticket is currently handled by AI
        if (currentStatus === 'OPEN') {
          const historyDocs = await databases.listDocuments(dbId, messagesCol, [
            Query.equal('ticketId', ticketId),
            Query.orderAsc('$createdAt')
          ]);

          const formattedHistory = historyDocs.documents.map((doc: any) => ({
            senderType: doc.senderType,
            content: doc.content,
          }));

          const aiResponseText = await processTicketWithAI(ticketId, formattedHistory);

          // FIX: Unified AI Handover Logic
          if (aiResponseText.includes('TRIGGER_HANDOVER')) {
            const hoursStatus = checkBusinessHours();
            const transcript = formattedHistory.map((m: any) => `${m.senderType}: ${m.content}`).join('\n');
            const summary = await summarizeChatForAgent(transcript);

            const handoverMessage = hoursStatus.isOnline
              ? 'I have added you to our support queue. An agent will be with you shortly.'
              : hoursStatus.message;

            await databases.updateDocument(dbId, ticketsCol, ticketId, {
              status: 'PENDING_AGENT',
              aiSummary: summary,
            });

            await databases.createDocument(dbId, messagesCol, ID.unique(), {
              ticketId, senderType: 'SYSTEM', senderName: 'System',
              content: handoverMessage
            });

            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: customerPhone.replace("+", ""),
                type: "text",
                text: { body: handoverMessage }
              })
            });

          } else {
            // Normal AI text response
            await databases.createDocument(dbId, messagesCol, ID.unique(), {
              ticketId, senderType: 'ASSISTANT', senderName: 'Lora Assistant', content: aiResponseText
            });

            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: customerPhone.replace("+", ""),
                type: "text",
                text: { body: aiResponseText }
              })
            });
          }
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
