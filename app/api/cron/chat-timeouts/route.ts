import { NextResponse } from 'next/server';
import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';

export const dynamic = 'force-dynamic';

// Helper to send the WhatsApp text directly
async function sendMetaText(phone: string, text: string) {
  const metaToken = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!metaToken || !phoneNumberId) return;

  await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
    method: "POST", 
    headers: { "Authorization": `Bearer ${metaToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ 
      messaging_product: "whatsapp", 
      to: phone.replace("+", ""), 
      type: "text", 
      text: { body: text } 
    })
  });
}

export async function GET(req: Request) {
  // 1. SECURITY GATE
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('secret'); 
  const authHeader = req.headers.get('authorization');
  const headerSecret = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null; 

  const providedSecret = querySecret || headerSecret;

  if (providedSecret !== process.env.CRON_SECRET) {
    console.warn(`[SECURITY WARNING] Unauthorized attempt to trigger cron job`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. INITIALIZE APPWRITE
  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_SECRET_KEY!);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;
  const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID!;

  try {
    // 3. FETCH ACTIVE TICKETS (Explicitly ignoring PENDING_AGENT)
    const activeTickets = await databases.listDocuments(dbId, ticketsCol, [
      Query.notEqual('status', 'CLOSED'),
      Query.notEqual('status', 'RESOLVED'),
      Query.notEqual('status', 'PENDING_AGENT') 
    ]);

    const now = new Date();

    for (const ticket of activeTickets.documents) {
      if (!ticket.lastActivityAt) continue;

      const lastActivity = new Date(ticket.lastActivityAt);
      const diffInMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

      // ==========================================
      // SCENARIO A: 10 Minutes Inactive -> Close Chat
      // ==========================================
      if (diffInMinutes >= 10) {
        const closeMsg = "Your session has been closed due to inactivity. If you still need help, simply reply to this message to start a new chat. Have a great day!";
        
        // Update Ticket Status
        await databases.updateDocument(dbId, ticketsCol, ticket.$id, { status: 'CLOSED' });
        
        // 🚀 FIX: WRITE TO DATABASE SO THE WEB WIDGET SEES IT
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
           ticketId: ticket.$id, 
           senderType: 'SYSTEM', 
           senderName: 'System', 
           sourceChannel: ticket.sourceChannel, 
           content: closeMsg
        });

        // Fire to WhatsApp if needed
        if (ticket.sourceChannel === 'WHATSAPP') {
          await sendMetaText(ticket.customerPhone, closeMsg);
        }
      } 
      
      // ==========================================
      // SCENARIO B: 5 Minutes Inactive -> Send Warning
      // ==========================================
      else if (diffInMinutes >= 5 && !ticket.warningSent) {
        const warnMsg = "Are you still there? We haven't heard from you in a while. We will automatically close this chat in 5 minutes if there is no response.";
        
        // Flag warning as sent
        await databases.updateDocument(dbId, ticketsCol, ticket.$id, { warningSent: true });

        // 🚀 FIX: WRITE TO DATABASE SO THE WEB WIDGET SEES IT
        await databases.createDocument(dbId, messagesCol, ID.unique(), {
           ticketId: ticket.$id, 
           senderType: 'SYSTEM', 
           senderName: 'System', 
           sourceChannel: ticket.sourceChannel, 
           content: warnMsg
        });

        // Fire to WhatsApp if needed
        if (ticket.sourceChannel === 'WHATSAPP') {
          await sendMetaText(ticket.customerPhone, warnMsg);
        }
      }
    }

    return NextResponse.json({ status: 'SUCCESS', message: 'Timeout sweep completed.' });
  } catch (error: any) {
    console.error('[CRON ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
