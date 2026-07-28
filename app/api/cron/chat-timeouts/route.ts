import { NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';
import { sendWhatsAppText } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // Optional: Add a simple secret header check here so random people can't trigger your cron

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_SECRET_KEY!);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;

  try {
    // 1. Find all tickets that are currently active (not closed)
    const activeTickets = await databases.listDocuments(dbId, ticketsCol, [
      Query.notEqual('status', 'CLOSED'),
      Query.notEqual('status', 'RESOLVED')
    ]);

    const now = new Date();

    for (const ticket of activeTickets.documents) {
      if (!ticket.lastActivityAt) continue;

      const lastActivity = new Date(ticket.lastActivityAt);
      const diffInMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);

      // SCENARIO A: 10 Minutes Inactive -> Close Chat
      if (diffInMinutes >= 10) {
        await databases.updateDocument(dbId, ticketsCol, ticket.$id, { status: 'CLOSED' });
        
        if (ticket.sourceChannel === 'WHATSAPP') {
          await sendWhatsAppText(ticket.customerPhone, "Your session has been closed due to inactivity. If you still need help, simply reply to this message to start a new chat. Have a great day!");
        }
        // (Add your In-App websocket closure logic here if needed)
      } 
      
      // SCENARIO B: 5 Minutes Inactive -> Send Warning
      else if (diffInMinutes >= 5 && !ticket.warningSent) {
        await databases.updateDocument(dbId, ticketsCol, ticket.$id, { warningSent: true });
        
        if (ticket.sourceChannel === 'WHATSAPP') {
          await sendWhatsAppText(ticket.customerPhone, "Are you still there? We haven't heard from you in a while. We will automatically close this chat in 5 minutes if there is no response.");
        }
      }
    }

    return NextResponse.json({ status: 'SUCCESS', message: 'Timeout sweep completed.' });
  } catch (error: any) {
    console.error('[CRON ERROR]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
