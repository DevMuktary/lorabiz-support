import { NextResponse } from 'next/server';
import { Client, Databases, Query } from 'node-appwrite';
import { sendWhatsAppText } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // SECURITY GATE
  const url = new URL(req.url);
  const querySecret = url.searchParams.get('secret'); 
  const authHeader = req.headers.get('authorization');
  const headerSecret = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null; 

  const providedSecret = querySecret || headerSecret;

  if (providedSecret !== process.env.CRON_SECRET) {
    console.warn(`[SECURITY WARNING] Unauthorized attempt to trigger cron job`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = new Client()
    .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
    .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
    .setKey(process.env.APPWRITE_SECRET_KEY!);

  const databases = new Databases(client);
  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;

  try {
    // 🚀 THE FIX: We now explicitly ignore PENDING_AGENT tickets! 
    // The timeout clock is paused while waiting for a human.
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

      // SCENARIO A: 10 Minutes Inactive -> Close Chat
      if (diffInMinutes >= 10) {
        await databases.updateDocument(dbId, ticketsCol, ticket.$id, { status: 'CLOSED' });
        
        if (ticket.sourceChannel === 'WHATSAPP') {
          await sendWhatsAppText(ticket.customerPhone, "Your session has been closed due to inactivity. If you still need help, simply reply to this message to start a new chat. Have a great day!");
        }
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
