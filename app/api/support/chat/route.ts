// app/api/support/chat/route.ts

import { NextResponse } from 'next/server';
import { Client, Databases, Query, ID } from 'node-appwrite';
import { processTicketWithAI } from '@/lib/ai';
import { summarizeChatForAgent } from '@/lib/ai-summarizer';
import { checkBusinessHours } from '@/lib/business-hours';

// Initialize Secure Server-Side Appwrite Client
const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT || '')
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID || '')
  .setKey(process.env.APPWRITE_API_KEY || '');

const databases = new Databases(client);

const DATABASE_ID = process.env.APPWRITE_DATABASE_ID || 'lorabiz_support';
const TICKETS_COLLECTION_ID = process.env.APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
const MESSAGES_COLLECTION_ID = process.env.APPWRITE_MESSAGES_COLLECTION_ID || 'messages';

// Security Constraints
const MAX_MESSAGE_LENGTH = 2000; // Prevents context-swelling & token drain attacks

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { ticketId, message, senderId, senderName } = body;

    // 1. Strict Input Validation & Security Checks
    if (!ticketId || typeof ticketId !== 'string') {
      return NextResponse.json({ error: 'Invalid or missing ticketId' }, { status: 400 });
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message content cannot be empty' }, { status: 400 });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        { error: `Message exceeds maximum allowed limit of ${MAX_MESSAGE_LENGTH} characters.` },
        { status: 400 }
      );
    }

    // Basic sanitization
    const sanitizedMessage = message.trim();

    // 2. Fetch Active Ticket State from Appwrite
    const ticket = await databases.getDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Prevent interactions on resolved/closed tickets
    if (ticket.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'This ticket is closed. Please open a new inquiry.' },
        { status: 400 }
      );
    }

    // 3. Save User Message to Database
    await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, ID.unique(), {
      ticketId,
      senderType: 'CUSTOMER',
      senderId: senderId || 'ANONYMOUS',
      senderName: senderName || 'User',
      content: sanitizedMessage,
      createdAt: new Date().toISOString(),
    });

    // 4. SILENCE PROTOCOL CHECK:
    // If ticket is already transferred to an agent, DO NOT invoke the AI.
    if (ticket.status === 'PENDING_AGENT' || ticket.status === 'IN_PROGRESS') {
      return NextResponse.json({
        status: 'RECEIVED',
        aiProcessed: false,
        message: 'Message delivered to your support agent.',
      });
    }

    // 5. Fetch Full Message History for AI Context
    const historyDocs = await databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
      Query.equal('ticketId', ticketId),
      Query.orderAsc('createdAt'),
      Query.limit(50), // Standard context window depth
    ]);

    const formattedHistory = historyDocs.documents.map((doc) => ({
      senderType: doc.senderType,
      content: doc.content,
    }));

    // 6. Execute AI Engine Processing
    const aiResponse = await processTicketWithAI(ticketId, formattedHistory);

    // 7. Handle Agent Handover Trigger
    if (aiResponse.includes('TRIGGER_HANDOVER')) {
      const hoursStatus = checkBusinessHours();

      // Transcribe history for summarizer
      const transcript = formattedHistory
        .map((m) => `${m.senderType}: ${m.content}`)
        .join('\n');

      // Asynchronously generate AI brief for the dashboard
      const summary = await summarizeChatForAgent(transcript);

      // System Handover Message to client
      const handoverMessage = hoursStatus.isOnline
        ? 'I am now connecting you with a human support agent. Please hold while an agent reviews your request.'
        : hoursStatus.message;

      // Update Ticket Record in Appwrite
      await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION_ID, ticketId, {
        status: 'PENDING_AGENT',
        aiSummary: summary,
        updatedAt: new Date().toISOString(),
      });

      // Save System Handover Message to Messages Database
      await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, ID.unique(), {
        ticketId,
        senderType: 'SYSTEM',
        senderId: 'LORA_SYSTEM',
        senderName: 'Lora',
        content: handoverMessage,
        createdAt: new Date().toISOString(),
      });

      return NextResponse.json({
        status: 'HANDOVER_INITIATED',
        aiProcessed: true,
        reply: handoverMessage,
        isAgentOnline: hoursStatus.isOnline,
      });
    }

    // 8. Normal AI Reply Flow
    await databases.createDocument(DATABASE_ID, MESSAGES_COLLECTION_ID, ID.unique(), {
      ticketId,
      senderType: 'ASSISTANT',
      senderId: 'LORA_BOT',
      senderName: 'Lora',
      content: aiResponse,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      status: 'SUCCESS',
      aiProcessed: true,
      reply: aiResponse,
    });
  } catch (error: any) {
    // Secure Error Logging: Never expose raw stack traces to the client
    console.error('[SUPPORT_CHAT_API_ERROR]:', error);

    return NextResponse.json(
      { error: 'An unexpected internal error occurred. Please try again later.' },
      { status: 500 }
    );
  }
}
