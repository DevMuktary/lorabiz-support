'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import { client, databases, account, storage } from '@/lib/appwrite-client'; // <-- IMPORTED STORAGE
import { Query, ID } from 'appwrite'; 
import { Ticket, Message } from '@/types/dashboard';
import { checkBusinessHours } from '@/lib/business-hours';

import TicketQueue from '@/components/dashboard/TicketQueue';
import ChatArea from '@/components/dashboard/ChatArea'; 

export default function DashboardPage() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true); 
  const [isFetchingChat, setIsFetchingChat] = useState(false); 
  
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);
  const [businessStatus, setBusinessStatus] = useState({ isOnline: true, message: '' });

  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
  const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
  const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';
  const bucketId = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || 'attachments'; // <-- ADDED BUCKET ID

  const activeTicketIdRef = useRef<string | null>(null);
  activeTicketIdRef.current = selectedTicket?.$id || null;

  useEffect(() => { setBusinessStatus(checkBusinessHours()); }, []);

  const fetchTickets = async () => {
    try {
      const response = await databases.listDocuments(dbId, ticketsCol, [Query.orderDesc('$createdAt')]);
      const fetchedTickets = response.documents as unknown as Ticket[];
      setTickets(fetchedTickets);
      
      if (activeTicketIdRef.current) {
        const updated = fetchedTickets.find(t => t.$id === activeTicketIdRef.current);
        if (updated) {
          setSelectedTicket(prev => {
            if (prev?.status !== updated.status || prev?.lastMessage !== updated.lastMessage) {
              return updated;
            }
            return prev;
          });
        }
      }
    } catch (err) { console.error(err); } finally {
      setIsPageLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    setIsFetchingChat(true);
    try {
      const response = await databases.listDocuments(dbId, messagesCol, [Query.equal('ticketId', ticketId), Query.orderAsc('$createdAt')]);
      setMessages(response.documents as unknown as Message[]);
    } catch (err) { console.error(err); } finally {
      setIsFetchingChat(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    let unsubscribeTickets = () => {};

    const initSecureSession = async () => {
      try { await account.get(); } 
      catch {
        const res = await fetch('/api/auth/appwrite-token', { method: 'POST' });
        if (res.ok) {
          const { token } = await res.json();
          await account.createSession(user.id, token);
        } else return;
      }
      
      fetchTickets();
      unsubscribeTickets = client.subscribe(`databases.${dbId}.collections.${ticketsCol}.documents`, (response: any) => {
        fetchTickets(); 
        if (response.payload.$id === activeTicketIdRef.current) setIsCustomerTyping(response.payload.customerTyping || false);
      });
    };

    initSecureSession();
    return () => unsubscribeTickets();
  }, [user, dbId, ticketsCol]);

  const activeTicketId = selectedTicket?.$id;
  useEffect(() => {
    if (!activeTicketId || !user) return;
    fetchMessages(activeTicketId);
    
    const unsubscribeMessages = client.subscribe(`databases.${dbId}.collections.${messagesCol}.documents`, (response: any) => {
      if (response.events.includes('databases.*.collections.*.documents.*.create') && response.payload.ticketId === activeTicketId) {
        setMessages((prev) => {
          if (prev.find((m) => m.$id === response.payload.$id)) return prev;
          return [...prev, response.payload as unknown as Message];
        });
        if (response.payload.senderType === 'CUSTOMER') setIsCustomerTyping(false);
      }
    });
    return () => unsubscribeMessages();
  }, [activeTicketId, dbId, messagesCol, user]);

  // ==========================================
  // SMART OUTBOUND NOTIFICATIONS (NOW SUPPORTS ATTACHMENTS)
  // ==========================================
  const notifyExternalChannel = async (
    ticket: Ticket, 
    content: string, 
    agentName: string, 
    actionType: 'REPLY' | 'GREETING' | 'CLOSE' | 'REOPEN',
    attachmentUrl?: string | null
  ) => {
    try {
      if (ticket.sourceChannel === 'WHATSAPP' && ticket.customerPhone) {
        await fetch('/api/support/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerPhone: ticket.customerPhone, content, attachmentUrl })
        });
      } 
      else if (ticket.sourceChannel === 'EMAIL' && ticket.customerEmail) {
        if (actionType === 'GREETING' || actionType === 'REOPEN') return;

        const realName = messages.slice().reverse().find(m => m.senderType === 'CUSTOMER')?.senderName || 'Customer';
        await fetch('/api/support/email/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toEmail: ticket.customerEmail,
            customerName: realName,
            type: 'AGENT_REPLY',
            content: content || 'Please see the attached document.',
            ticketId: ticket.$id,
            agentName,
            attachmentUrl
          })
        });
      }
    } catch (err) {
      console.error("Failed to notify external channel:", err);
    }
  };

  // ==========================================
  // ACTIONS
  // ==========================================
  const handlePickTicket = async () => {
    if (!selectedTicket || !user) return;
    setLoading(true);
    const agentName = user.firstName || 'Support Agent';
    const greetingMsg = `Hi, my name is ${agentName} and I will be supporting you today. Please give me a minute to review the chat.`;
    
    try {
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, { status: 'IN_PROGRESS', assignedAgentId: user.id });
      
      await databases.createDocument(dbId, messagesCol, ID.unique(), { 
        ticketId: selectedTicket.$id, senderType: 'AGENT', senderName: agentName, 
        sourceChannel: selectedTicket.sourceChannel, content: greetingMsg 
      });
      
      await notifyExternalChannel(selectedTicket, greetingMsg, agentName, 'GREETING');
      fetchTickets();
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleEndChat = async () => {
    if (!selectedTicket || !user) return;
    setLoading(true);
    const agentName = user.firstName || 'Support Agent';
    const endMsg = 'The human agent has closed this session. If you need further assistance, please start a new request.';

    try {
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, { status: 'CLOSED', assignedAgentId: null });
      
      await databases.createDocument(dbId, messagesCol, ID.unique(), { 
        ticketId: selectedTicket.$id, senderType: 'SYSTEM', senderName: 'System', 
        sourceChannel: selectedTicket.sourceChannel, content: endMsg 
      });
      
      await notifyExternalChannel(selectedTicket, endMsg, agentName, 'CLOSE');
      fetchTickets(); 
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  const handleReopenTicket = async () => {
    if (!selectedTicket || !user) return;
    setLoading(true);
    const agentName = user.firstName || 'Support Agent';
    const reopenMsg = `Hi again, ${agentName} here. I've reopened your ticket. How can I assist you further?`;

    try {
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, { status: 'IN_PROGRESS', assignedAgentId: user.id });
      
      await databases.createDocument(dbId, messagesCol, ID.unique(), { 
        ticketId: selectedTicket.$id, senderType: 'AGENT', senderName: agentName, 
        sourceChannel: selectedTicket.sourceChannel, content: reopenMsg 
      });

      await notifyExternalChannel(selectedTicket, reopenMsg, agentName, 'REOPEN');
      fetchTickets(); 
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  // 🚀 UPDATED: NOW SUPPORTS FILE UPLOADS
  const handleSendMessage = async (replyContent: string, isInternalNote: boolean = false, file: File | null = null) => {
    if (!replyContent.trim() && !file) return;
    if (!selectedTicket || !user) return;
    setLoading(true);
    
    try {
      const agentName = user.firstName || 'Support Agent';
      let attachmentUrl = null;

      // Upload file directly using secure Admin permissions
      if (file) {
        const upload = await storage.createFile(bucketId, ID.unique(), file);
        attachmentUrl = storage.getFileView(bucketId, upload.$id).toString();
      }
      
      await databases.createDocument(dbId, messagesCol, ID.unique(), { 
        ticketId: selectedTicket.$id, 
        senderType: isInternalNote ? 'SYSTEM' : 'AGENT', 
        senderName: isInternalNote ? 'Internal Note' : agentName, 
        sourceChannel: selectedTicket.sourceChannel, 
        content: isInternalNote ? `[INTERNAL NOTE]: ${replyContent}` : (replyContent || '[Attachment sent]'),
        attachmentUrl
      });

      if (!isInternalNote) {
        await notifyExternalChannel(selectedTicket, replyContent || '[Attachment]', agentName, 'REPLY', attachmentUrl);
      }

    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  if (isPageLoading) {
    return (
      <div className="h-screen w-full bg-[#050b1b] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#c82d75] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-gray-400 text-sm font-bold tracking-widest uppercase">Connecting Workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050b1b] text-white overflow-hidden font-sans">
      <div className={`h-full ${selectedTicket ? 'hidden md:flex' : 'flex w-full md:w-auto'} shrink-0`}>
        <TicketQueue tickets={tickets} selectedTicket={selectedTicket} onSelectTicket={setSelectedTicket} businessStatus={businessStatus} />
      </div>
      
      <div className={`h-full flex-1 ${!selectedTicket ? 'hidden md:flex' : 'flex w-full'}`}>
        {!selectedTicket ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#050b1b]">
            <div className="w-16 h-16 rounded-full bg-[#0d152b] flex items-center justify-center mb-4 border border-white/5">
              <svg className="w-8 h-8 text-[#c82d75]/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <p className="text-sm tracking-wide">Select a ticket from the queue to begin.</p>
          </div>
        ) : (
           <ChatArea 
             ticket={selectedTicket}
             messages={messages}
             isFetchingChat={isFetchingChat}
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
    </div>
  );
}
