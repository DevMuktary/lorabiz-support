import { NextResponse } from 'next/server';
import { Client, Databases, Query, ID, Permission, Role } from 'node-appwrite';
import { sendZeptoMail } from '@/lib/zeptomail';
import { templates } from '@/lib/email-templates';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_SECRET_KEY || '');

const databases = new Databases(client);
const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
const TICKETS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
const MESSAGES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';

const securePermissions = [
  Permission.read(Role.team('agents')),
  Permission.update(Role.team('agents')),
  Permission.delete(Role.team('agents'))
];

function cleanEmailBody(text: string) {
  if (!text) return "[No content]";
  return text.split(/(On\s.*wrote:|From:|Sent from my iPhone)/i)[0].trim();
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // THE BREVO FIX: Extracting data from Brevo's specific 'items' array
    const item = body.items && body.items.length > 0 ? body.items[0] : body;
    
    const fromAddress = item.From?.Address || item.from_address || item.from?.address;
    const fromName = item.From?.Name || item.from?.name || fromAddress?.split('@')[0] || "Customer";
    const subject = item.Subject || item.subject || 'No Subject';
    const rawTextBody = item.RawTextBody || item.textbody || item.textContent || '';
    
    if (!fromAddress) {
      return NextResponse.json({ error: 'Missing sender address' }, { status: 400 });
    }

    const cleanContent = cleanEmailBody(rawTextBody);
    
    // 1. THE REGEX SNIFFER: Check if this is a reply to an existing ticket
    const ticketMatch = subject.match(/\[(TICKET_[A-Za-z0-9_]+)\]/);
    let activeTicketId = ticketMatch ? ticketMatch[1] : null;

    if (activeTicketId) {
      try {
        const ticket = await databases.getDocument(DATABASE_ID, TICKETS_COLLECTION_ID, activeTicketId);
        
        await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, ID.unique(), {
          ticketId: activeTicketId,
          senderType: 'CUSTOMER',
          senderId: fromAddress,
          senderName: fromName,
          sourceChannel: 'EMAIL',
          content: cleanContent,
        }, securePermissions);

        if (ticket.status === 'CLOSED' || ticket.status === 'RESOLVED') {
          await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, activeTicketId, { status: 'PENDING_AGENT' });
        }

        return NextResponse.json({ status: 'SUCCESS', action: 'APPENDED_TO_THREAD' });
      } catch (err) {
        console.warn(`[EMAIL WEBHOOK] Ticket ${activeTicketId} not found in DB. Creating new.`);
        activeTicketId = null; 
      }
    }

    // 2. THE SECURITY BRIDGE: Check the Main App
    if (!activeTicketId) {
      let registeredUserId = null;
      let finalCustomerName = fromName;

      try {
        const mainAppUrl = process.env.MAIN_APP_URL || 'https://lumebiz.com';
        const bridgeResponse = await fetch(`${mainAppUrl}/api/internal/verify-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: fromAddress, 
            secret: process.env.INTERNAL_API_SECRET 
          })
        });

        const bridgeData = await bridgeResponse.json();
        
        if (bridgeData.exists && bridgeData.userId) {
          registeredUserId = bridgeData.userId;
          finalCustomerName = bridgeData.name || fromName;
        }
      } catch (bridgeError) {
        console.error(`[EMAIL WEBHOOK ERROR] Bridge failed:`, bridgeError);
      }

      const newTicketId = `TICKET_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      
      await databases.createDocument(DATABASE_ID, TICKETS_COLLECTION_ID, newTicketId, {
        status: 'PENDING_AGENT', 
        sourceChannel: 'EMAIL',
        title: subject.length > 50 ? subject.substring(0, 50) + '...' : subject,
        customerEmail: fromAddress,
        userId: registeredUserId 
      }, securePermissions);

      await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, ID.unique(), {
        ticketId: newTicketId,
        senderType: 'CUSTOMER',
        senderId: fromAddress,
        senderName: finalCustomerName,
        sourceChannel: 'EMAIL',
        content: cleanContent,
      }, securePermissions);

      // 3. THE AUTO-RESPONDER (Sent via ZeptoMail out)
      try {
        await sendZeptoMail({
          toEmail: fromAddress,
          toName: finalCustomerName,
          subject: `Request Received [${newTicketId}]`,
          htmlBody: templates.autoResponder(finalCustomerName, newTicketId)
        });
      } catch (mailError) {
        console.error(`[EMAIL WEBHOOK ERROR] Failed to send auto-responder:`, mailError);
      }

      return NextResponse.json({ status: 'SUCCESS', action: 'CREATED_NEW_TICKET', ticketId: newTicketId });
    }

  } catch (error: any) {
    console.error(`[EMAIL WEBHOOK CRITICAL ERROR]`, error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
