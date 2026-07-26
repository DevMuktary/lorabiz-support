'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { client, databases } from '@/lib/appwrite';
import { Query, ID } from 'appwrite';
import { Send, Phone, Mail, MessageSquare, ChevronLeft } from 'lucide-react';

// --- Types ---
interface Ticket {
  $id: string;
  customerPhone?: string;
  customerEmail?: string;
  sourceChannel: 'WHATSAPP' | 'EMAIL' | 'IN_APP';
  status: 'AI_HANDLING' | 'PENDING_AGENT' | 'IN_PROGRESS' | 'RESOLVED';
  lastMessage?: string;
}

interface Message {
  $id: string;
  ticketId: string;
  senderType: 'CUSTOMER' | 'AI' | 'AGENT';
  senderName: string;
  content: string;
  $createdAt: string;
  attachmentUrl?: string; // Added for when we handle image uploads
}

export default function DashboardPage() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
  const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;
  const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID!;

  // Scroll to bottom of chat automatically
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fetch Tickets
  const fetchTickets = async () => {
    try {
      const response = await databases.listDocuments(dbId, ticketsCol, [
        Query.orderDesc('$createdAt'),
      ]);
      setTickets(response.documents as unknown as Ticket[]);
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

  // Real-time Subscriptions
  useEffect(() => {
    fetchTickets();
    const unsubscribeTickets = client.subscribe(
      `databases.${dbId}.collections.${ticketsCol}.documents`,
      () => fetchTickets()
    );
    return () => unsubscribeTickets();
  }, [dbId, ticketsCol]);

  useEffect(() => {
    if (!selectedTicket) return;
    fetchMessages(selectedTicket.$id);
    const unsubscribeMessages = client.subscribe(
      `databases.${dbId}.collections.${messagesCol}.documents`,
      (response) => {
        const newMessage = response.payload as unknown as Message;
        if (newMessage.ticketId === selectedTicket.$id) {
          setMessages((prev) => [...prev, newMessage]);
        }
      }
    );
    return () => unsubscribeMessages();
  }, [selectedTicket, dbId, messagesCol]);

  // Send Message Logic
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedTicket || !user) return;

    setLoading(true);
    try {
      // 1. Inject the Agent's real name into the message
      const agentName = user.fullName || 'Support Agent';
      
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id,
        senderType: 'AGENT',
        senderName: agentName, 
        content: replyContent,
      });

      // 2. Update the ticket status
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, {
        status: 'IN_PROGRESS',
        assignedAgentId: user.id,
        lastMessage: replyContent,
      });

      // 3. Send the message to the customer's actual WhatsApp
      if (selectedTicket.sourceChannel === 'WHATSAPP' && selectedTicket.customerPhone) {
        await fetch('/api/support/outbound', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customerPhone: selectedTicket.customerPhone,
            content: `*[${agentName}]*\n${replyContent}` // Injects the staff name neatly
          })
        });
      }

      setReplyContent('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden">
      
      {/* SIDEBAR: Ticket List */}
      <div className={`w-full md:w-1/3 border-r border-slate-200 flex flex-col bg-slate-50 ${selectedTicket ? 'hidden md:flex' : 'flex'}`}>
        <header className="p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-600" />
            <h1 className="font-semibold text-lg">Inbox</h1>
          </div>
          <UserButton />
        </header>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-500 text-center mt-10">No active tickets.</p>
          ) : (
            tickets.map((t) => (
              <div
                key={t.$id}
                onClick={() => setSelectedTicket(t)}
                className={`p-3 rounded-xl border cursor-pointer transition-all ${
                  selectedTicket?.$id === t.$id
                    ? 'bg-indigo-50 border-indigo-200 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 truncate">
                    {t.sourceChannel === 'WHATSAPP' && <Phone className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                    {t.sourceChannel === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-sky-500 shrink-0" />}
                    <span className="truncate">{t.customerPhone || t.customerEmail || 'Anonymous'}</span>
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                      t.status === 'PENDING_AGENT'
                        ? 'bg-amber-100 text-amber-700'
                        : t.status === 'IN_PROGRESS'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-sm text-slate-500 truncate">{t.lastMessage || 'Waiting for reply...'}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className={`flex-1 flex flex-col bg-white ${!selectedTicket ? 'hidden md:flex' : 'flex'}`}>
        {selectedTicket ? (
          <>
            {/* Chat Header */}
            <header className="p-4 border-b border-slate-200 bg-white shadow-sm flex items-center gap-3 z-10 shrink-0">
              <button 
                onClick={() => setSelectedTicket(null)}
                className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div>
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  {selectedTicket.customerPhone || selectedTicket.customerEmail || `Ticket #${selectedTicket.$id.slice(-6)}`}
                </h2>
                <p className="text-xs text-slate-500">
                  via {selectedTicket.sourceChannel}
                </p>
              </div>
            </header>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.$id}
                  className={`flex flex-col ${
                    msg.senderType === 'AGENT' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] p-3 text-sm shadow-sm ${
                      msg.senderType === 'AGENT'
                        ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm'
                        : msg.senderType === 'AI'
                        ? 'bg-slate-200 text-slate-800 rounded-2xl rounded-tl-sm border border-slate-300'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-2xl rounded-tl-sm'
                    }`}
                  >
                    <div className="text-[10px] opacity-70 mb-1 font-semibold uppercase tracking-wider">
                      {msg.senderName}
                    </div>
                    {/* If there's an image attached, render it */}
                    {msg.attachmentUrl && (
                      <img 
                        src={msg.attachmentUrl} 
                        alt="Attachment" 
                        className="mb-2 max-w-full rounded-lg border border-slate-200/20" 
                      />
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex gap-2 shrink-0 pb-safe">
              <input
                type="text"
                placeholder="Type your reply..."
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                className="flex-1 bg-slate-100 border border-transparent rounded-full px-5 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
              />
              <button
                type="submit"
                disabled={loading || !replyContent.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-5 h-5 -ml-0.5" />
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
            <MessageSquare className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-medium text-slate-600">No conversation selected yet</p>
            <p className="text-sm">Choose a ticket from the inbox to start replying.</p>
          </div>
        )}
      </div>
    </div>
  );
}