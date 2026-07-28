'use client';

import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { client, databases, account } from '@/lib/appwrite-client';
import { Query, ID } from 'appwrite'; 
import { Ticket, Message } from '@/types/dashboard';

// We will build these two in the next step!
import TicketQueue from '@/components/dashboard/TicketQueue';
import ChatArea from '@/components/dashboard/ChatArea'; 

export default function DashboardPage() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);

  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
  const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
  const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';

  // Fetch Tickets
  const fetchTickets = async () => {
    try {
      const response = await databases.listDocuments(dbId, ticketsCol, [
        Query.orderDesc('$createdAt'),
      ]);
      setTickets(response.documents as unknown as Ticket[]);
      
      if (selectedTicket) {
        const updated = response.documents.find(t => t.$id === selectedTicket.$id);
        if (updated) setSelectedTicket(updated as unknown as Ticket);
      }
    } catch (err) {
      console.error('Error fetching tickets:', err);
    }
  };

  // Fetch Messages
  const fetchMessages = async (ticketId: string) => {
    try {
      const response = await databases.listDocuments(dbId, messagesCol, [
        Query.equal('ticketId', ticketId),
        Query.orderAsc('$createdAt'),
      ]);
      setMessages(response.documents as unknown as Message[]);
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  };

  // Secure Appwrite Auth & Realtime Subscriptions
  useEffect(() => {
    if (!user) return;
    let unsubscribeTickets = () => {};

    const initSecureSession = async () => {
      try {
        await account.get();
      } catch {
        const res = await fetch('/api/auth/appwrite-token', { method: 'POST' });
        if (res.ok) {
          const { token } = await res.json();
          await account.createSession(user.id, token);
        } else return;
      }
      
      fetchTickets();
      unsubscribeTickets = client.subscribe(
        `databases.${dbId}.collections.${ticketsCol}.documents`,
        (response: any) => {
          fetchTickets(); 
          if (response.payload.$id === selectedTicket?.$id) {
            setIsCustomerTyping(response.payload.customerTyping || false);
          }
        }
      );
    };

    initSecureSession();
    return () => unsubscribeTickets();
  }, [user, dbId, ticketsCol, selectedTicket]);

  useEffect(() => {
    if (!selectedTicket || !user) return;
    fetchMessages(selectedTicket.$id);
    const unsubscribeMessages = client.subscribe(
      `databases.${dbId}.collections.${messagesCol}.documents`,
      (response: any) => {
        if (
          response.events.includes('databases.*.collections.*.documents.*.create') &&
          response.payload.ticketId === selectedTicket.$id
        ) {
          setMessages((prev) => {
            if (prev.find((m) => m.$id === response.payload.$id)) return prev;
            return [...prev, response.payload as unknown as Message];
          });
          if (response.payload.senderType === 'CUSTOMER') setIsCustomerTyping(false);
        }
      }
    );
    return () => unsubscribeMessages();
  }, [selectedTicket, dbId, messagesCol, user]);

  // -------------------------
  // TICKET ACTIONS
  // -------------------------

  const handlePickTicket = async () => {
    if (!selectedTicket || !user) return;
    setLoading(true);
    const agentName = user.firstName || 'Support Agent';
    try {
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, {
        status: 'IN_PROGRESS', assignedAgentId: user.id,
      });
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id, senderType: 'SYSTEM', senderName: 'System', sourceChannel: selectedTicket.sourceChannel,
        content: `Hi, my name is ${agentName} and I will be supporting you today. Please give me a minute to review the chat.`,
      });
      fetchTickets();
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleEndChat = async () => {
    if (!selectedTicket) return;
    setLoading(true);
    try {
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, {
        status: 'CLOSED', assignedAgentId: null, // Marks as closed instead of open
      });
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id, senderType: 'SYSTEM', senderName: 'System', sourceChannel: selectedTicket.sourceChannel,
        content: 'The human agent has closed this session. If you need further assistance, please start a new request.',
      });
      fetchTickets(); 
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // NEW FEATURE: Reopen Ticket
  const handleReopenTicket = async () => {
    if (!selectedTicket || !user) return;
    setLoading(true);
    const agentName = user.firstName || 'Support Agent';
    try {
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, {
        status: 'IN_PROGRESS', assignedAgentId: user.id,
      });
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id, senderType: 'SYSTEM', senderName: 'System', sourceChannel: selectedTicket.sourceChannel,
        content: `[System: Ticket Reopened by Agent ${agentName}]`,
      });
      fetchTickets(); 
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleSendMessage = async (replyContent: string, isInternalNote: boolean = false) => {
    if (!replyContent.trim() || !selectedTicket || !user) return;
    setLoading(true);
    try {
      const agentName = user.firstName || 'Support Agent';
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id,
        senderType: isInternalNote ? 'SYSTEM' : 'AGENT', // Note: We use SYSTEM for internal notes so the frontend widget hides them
        senderName: isInternalNote ? 'Internal Note' : agentName, 
        sourceChannel: selectedTicket.sourceChannel,
        content: isInternalNote ? `[INTERNAL NOTE]: ${replyContent}` : replyContent,
      });
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      <TicketQueue 
        tickets={tickets} 
        selectedTicket={selectedTicket} 
        onSelectTicket={setSelectedTicket} 
      />
      
      {/* Fallback while we build ChatArea */}
      {!selectedTicket ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 bg-white">
          <p>Select a ticket to begin.</p>
        </div>
      ) : (
         <ChatArea 
           ticket={selectedTicket}
           messages={messages}
           isCustomerTyping={isCustomerTyping}
           loading={loading}
           onBack={() => setSelectedTicket(null)}
           onPickTicket={handlePickTicket}
           onEndChat={handleEndChat}
           onReopenTicket={handleReopenTicket}
           onSendMessage={handleSendMessage}
         />
      )}
    </div>
  );
}
