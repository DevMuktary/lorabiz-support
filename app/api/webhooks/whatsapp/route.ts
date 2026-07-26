import { NextResponse } from 'next/server';
import { Client, Databases, Storage, Query, ID } from 'node-appwrite';
import { processTicketWithAI } from '@/lib/ai';

const adminClient = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_SECRET_KEY!);

const databases = new Databases(adminClient);
const storage = new Storage(adminClient);

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;
const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID!;
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!;

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
        let attachmentUrl = null;
        let isButtonReplyYes = false;

        // --- 1. HANDLE MESSAGE TYPE (TEXT, IMAGE, OR BUTTON CLICK) ---
        if (message.type === 'image' || message.type === 'document') {
          content = '[Attachment Received]';
          // ... (keep your existing image upload logic here if you want) ...
        } else if (message.type === 'interactive') {
          // The user clicked a WhatsApp Button
          const buttonId = message.interactive.button_reply.id;
          if (buttonId === 'agent_yes') {
            content = '[Clicked: Connect to Agent]';
            isButtonReplyYes = true;
          } else {
            content = '[Clicked: No Agent Needed]';
          }
        } else {
          content = message.text?.body || '';
        }

        // --- 2. TICKET MANAGEMENT ---
        const existingTickets = await databases.listDocuments(dbId, ticketsCol, [
          Query.equal('customerPhone', customerPhone),
          Query.notEqual('status', 'RESOLVED'),
          Query.orderDesc('$createdAt'),
          Query.limit(1)
        ]);

        let ticketId = '';
        let currentStatus = 'AI_HANDLING';

        if (existingTickets.documents.length > 0) {
          ticketId = existingTickets.documents[0].$id;
          currentStatus = isButtonReplyYes ? 'PENDING_AGENT' : existingTickets.documents[0].status;
          await databases.updateDocument(dbId, ticketsCol, ticketId, { 
            lastMessage: content,
            status: currentStatus 
          });
        } else {
          const newTicket = await databases.createDocument(dbId, ticketsCol, ID.unique(), {
            customerPhone: customerPhone,
            sourceChannel: 'WHATSAPP',
            status: isButtonReplyYes ? 'PENDING_AGENT' : 'AI_HANDLING',
            lastMessage: content
          });
          ticketId = newTicket.$id;
          currentStatus = newTicket.status;
        }

        // --- 3. SAVE CUSTOMER MESSAGE TO DATABASE ---
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId,
          senderType: 'CUSTOMER',
          senderName: customerName,
          content,
          attachmentUrl
        });

        // --- 4. THE AI BRAIN & BUTTON HANDLER ---
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const metaToken = process.env.WHATSAPP_TOKEN;

        // If they clicked YES, alert them an agent is coming and STOP the AI.
        if (isButtonReplyYes) {
           await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                to: customerPhone.replace("+", ""),
                type: "text",
                text: { body: "You have been placed in the queue. An available agent will be with you shortly." }
              })
            });
            return NextResponse.json({ success: true }); // Exit before AI runs
        }

        // If still assigned to AI, run the AI
        if (currentStatus === 'AI_HANDLING') {
          const history = await databases.listDocuments(dbId, messagesCol, [
            Query.equal('ticketId', ticketId),
            Query.orderAsc('$createdAt')
          ]);

          const aiResponseText = await processTicketWithAI(ticketId, history.documents);

          // CHECK FOR THE SECRET TRIGGER
          if (aiResponseText.includes('TRIGGER_HANDOVER')) {
            // Save log to DB
            await databases.createDocument(dbId, messagesCol, ID.unique(), {
              ticketId, senderType: 'AI', senderName: 'Lora Assistant',
              content: "[System: Offered human agent transfer to customer]"
            });

            // Send WhatsApp Interactive Buttons
            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: customerPhone.replace("+", ""),
                type: "interactive",
                interactive: {
                  type: "button",
                  body: { text: "I'm sorry, I don't have the exact information for that. Would you like me to connect you to an available agent to continue from here?" },
                  action: {
                    buttons: [
                      { type: "reply", reply: { id: "agent_yes", title: "Yes" } },
                      { type: "reply", reply: { id: "agent_no", title: "No" } }
                    ]
                  }
                }
              })
            });

          } else {
            // Normal AI response
            await databases.createDocument(dbId, messagesCol, ID.unique(), {
              ticketId, senderType: 'AI', senderName: 'Lora Assistant', content: aiResponseText
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