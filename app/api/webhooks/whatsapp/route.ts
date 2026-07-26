import { NextResponse } from 'next/server';
import { Client, Databases, Storage, Query, ID } from 'node-appwrite'; // <-- Changed to node-appwrite
import { processTicketWithAI } from '@/lib/ai';

// Initialize Appwrite with ADMIN privileges
const adminClient = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_SECRET_KEY!); // <-- Your new secret key

const databases = new Databases(adminClient);
const storage = new Storage(adminClient);

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;
const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID!;
const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID!;

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

        // --- 4. THE AI BRAIN (Only if status is AI_HANDLING) ---
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
            senderName: 'Lora Assistant',
            content: aiResponseText
          });

          // TODO: Trigger WhatsApp API to actually send `aiResponseText` back to the user's phone
          // await sendWhatsAppMessage(customerPhone, aiResponseText);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
