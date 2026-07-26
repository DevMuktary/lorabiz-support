import { NextResponse } from 'next/server';
import { Client, Databases, Storage, Query, ID } from 'node-appwrite';
import { processTicketWithAI } from '@/lib/ai';

// Initialize Appwrite with ADMIN privileges (Bypasses all client-side blocks)
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

// --- GET: META VERIFICATION HANDSHAKE ---
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("hub.mode") === "subscribe") {
    return new Response(url.searchParams.get("hub.challenge"), { status: 200 });
  }
  return new Response("Webhook Active", { status: 200 });
}

// --- POST: INCOMING WHATSAPP MESSAGES ---
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

        // --- 1. HANDLE FILE UPLOADS (IMAGES/DOCUMENTS) ---
        if (message.type === 'image' || message.type === 'document') {
          const mediaId = message[message.type].id;
          
          // Step A: Get Media URL from Meta
          const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${mediaId}`, {
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` }
          });
          const mediaData = await mediaRes.json();
          
          // Step B: Download file from Meta
          const downloadRes = await fetch(mediaData.url, {
            headers: { 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` }
          });
          const fileBlob = await downloadRes.blob();
          const file = new File([fileBlob], `${mediaId}.jpg`, { type: fileBlob.type });

          // Step C: Upload to Appwrite Storage
          const uploadedFile = await storage.createFile(bucketId, ID.unique(), file);
          
          // Get the URL to display on the dashboard
          attachmentUrl = `https://cloud.appwrite.io/v1/storage/buckets/${bucketId}/files/${uploadedFile.$id}/view?project=${process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID}`;
          content = '[Attachment Received]';
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
        if (existingTickets.documents.length > 0) {
          ticketId = existingTickets.documents[0].$id;
          await databases.updateDocument(dbId, ticketsCol, ticketId, { lastMessage: content });
        } else {
          const newTicket = await databases.createDocument(dbId, ticketsCol, ID.unique(), {
            customerPhone: customerPhone,
            sourceChannel: 'WHATSAPP',
            status: 'AI_HANDLING',
            lastMessage: content
          });
          ticketId = newTicket.$id;
        }

        // --- 3. SAVE CUSTOMER MESSAGE TO DATABASE ---
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
          ticketId,
          senderType: 'CUSTOMER',
          senderName: customerName,
          content,
          attachmentUrl
        });

        // --- 4. THE AI BRAIN ---
        const currentTicket = await databases.getDocument(dbId, ticketsCol, ticketId);
        
        if (currentTicket.status === 'AI_HANDLING') {
          // Fetch history
          const history = await databases.listDocuments(dbId, messagesCol, [
            Query.equal('ticketId', ticketId),
            Query.orderAsc('$createdAt')
          ]);

          // Get AI Response
          const aiResponseText = await processTicketWithAI(ticketId, history.documents);

          // Save AI message to database
          await databases.createDocument(dbId, messagesCol, ID.unique(), {
            ticketId,
            senderType: 'AI',
            senderName: 'AI Assistant',
            content: aiResponseText
          });

          // Send the AI response back to the customer's WhatsApp
          const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
          const metaToken = process.env.WHATSAPP_TOKEN;

          if (phoneNumberId && metaToken) {
            await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${metaToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: customerPhone.replace("+", ""), // Meta expects no plus sign
                type: "text",
                text: {
                  preview_url: true,
                  body: aiResponseText,
                },
              }),
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