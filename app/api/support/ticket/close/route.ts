// app/api/support/ticket/close/route.ts
import { NextResponse } from 'next/server';
import { Client, Databases } from 'node-appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(client);
const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'lorabiz_support';
const TICKETS_COLLECTION_ID = process.env.APPWRITE_TICKETS_COLLECTION_ID || 'tickets';

export async function POST(req: Request) {
  try {
    const { ticketId } = await req.json();

    if (!ticketId) {
      return NextResponse.json({ error: 'Ticket ID required' }, { status: 400 });
    }

    await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId, {
      status: 'CLOSED',
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ status: 'SUCCESS', message: 'Ticket closed successfully.' });
  } catch (error) {
    console.error('[TICKET_CLOSE_ERROR]:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
