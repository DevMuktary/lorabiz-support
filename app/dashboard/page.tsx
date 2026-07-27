'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useUser, UserButton } from '@clerk/nextjs';
import { client, databases } from '@/lib/appwrite-client';
// CRITICAL FIX: Use the Web SDK ('appwrite') instead of the Server SDK ('node-appwrite') on the frontend
import { Query, ID } from 'appwrite'; 
import { Send, Phone, Mail, MessageSquare, ChevronLeft, Bot, User, CheckCircle2, XCircle, Info } from 'lucide-react';

// --- Types ---
interface Ticket {
  $id: string;
  customerPhone?: string;
  customerEmail?: string;
  sourceChannel: 'WHATSAPP' | 'EMAIL' | 'IN_APP';
  status: 'OPEN' | 'PENDING_AGENT' | 'IN_PROGRESS' | 'CLOSED';
  lastMessage?: string;
  aiSummary?: string;
  assignedAgentId?: string;
  customerTyping?: boolean; // Ephemeral state for UI
}

interface Message {
  $id: string;
  ticketId: string;
  senderType: 'CUSTOMER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  senderName: string;
  content: string;
  $createdAt: string;
  attachmentUrl?: string;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyContent, setReplyContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [isCustomerTyping, setIsCustomerTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
  const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
  const messagesCol = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isCustomerTyping]);

  // Fetch Tickets
  const fetchTickets = async () => {
    try {
      const response = await databases.listDocuments(dbId, ticketsCol, [
        Query.orderDesc('$createdAt'),
      ]);
      setTickets(response.documents as unknown as Ticket[]);
      
      // Update selected ticket state if it changed in the background
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

  // Real-time Subscriptions
  useEffect(() => {
    fetchTickets();
    const unsubscribeTickets = client.subscribe(
      `databases.${dbId}.collections.${ticketsCol}.documents`,
      (response: any) => {
        fetchTickets(); // Refresh list on any ticket update
        
        // Listen for typing events if you implement a typing flag on the ticket document
        if (response.payload.$id === selectedTicket?.$id) {
          setIsCustomerTyping(response.payload.customerTyping || false);
        }
      }
    );
    return () => unsubscribeTickets();
  }, [dbId, ticketsCol, selectedTicket]);

  useEffect(() => {
    if (!selectedTicket) return;
    fetchMessages(selectedTicket.$id);
    const unsubscribeMessages = client.subscribe(
      `databases.${dbId}.collections.${messagesCol}.documents`,
      (response: any) => {
        if (
          response.events.includes('databases.*.collections.*.documents.*.create') &&
          response.payload.ticketId === selectedTicket.$id
        ) {
          setMessages((prev) => {
            const exists = prev.find((m) => m.$id === response.payload.$id);
            if (exists) return prev;
            return [...prev, response.payload as unknown as Message];
          });
          // Turn off typing indicator when a new message arrives
          if (response.payload.senderType === 'CUSTOMER') {
             setIsCustomerTyping(false);
          }
        }
      }
    );
    return () => unsubscribeMessages();
  }, [selectedTicket, dbId, messagesCol]);

  // --- Agent Workflows ---

  const handlePickTicket = async () => {
    if (!selectedTicket || !user) return;
    setLoading(true);
    
    const agentName = user.firstName || 'Support Agent';
    const introMessage = `Hi, my name is ${agentName} and I will be supporting you today. Please give me a minute to review the chat.`;

    try {
      // 1. Update ticket status
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, {
        status: 'IN_PROGRESS',
        assignedAgentId: user.id,
      });

      // 2. Send introductory system message to customer
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id,
        senderType: 'SYSTEM',
        senderName: 'System',
        sourceChannel: selectedTicket.sourceChannel,
        content: introMessage,
      });

      fetchTickets(); // Refresh state
    } catch (error) {
      console.error("Failed to pick ticket:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEndChat = async () => {
    if (!selectedTicket) return;
    setLoading(true);

    try {
      // 1. Return ticket to AI Control
      await databases.updateDocument(dbId, ticketsCol, selectedTicket.$id, {
        status: 'OPEN',
        assignedAgentId: null,
      });

      // 2. Notify Customer
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id,
        senderType: 'SYSTEM',
        senderName: 'System',
        sourceChannel: selectedTicket.sourceChannel,
        content: 'The human agent has ended this session. Lora (AI) is back online and ready to assist you.',
      });

      fetchTickets(); // Refresh state
    } catch (error) {
      console.error("Failed to end chat:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !selectedTicket || !user) return;

    setLoading(true);
    try {
      const agentName = user.firstName || 'Support Agent';
      
      await databases.createDocument(dbId, messagesCol, ID.unique(), {
        ticketId: selectedTicket.$id,
        senderType: 'AGENT',
        senderName: agentName, 
        sourceChannel: selectedTicket.sourceChannel,
        content: replyContent,
      });

      setReplyContent('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 overflow-hidden font-sans">
      
      {/* SIDEBAR: Ticket List */}
      <div className={`w-full md:w-[350px] lg:w-[400px] border-r border-gray-200 flex flex-col bg-white ${selectedTicket ? 'hidden md:flex' : 'flex'} shadow-[2px_0_10px_rgba(0,0,0,0.03)] z-10`}>
        <header className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center shadow-md">
              <Bot className="w-4 h-4 text-[#8B2D75]" />
            </div>
            <h1 className="font-bold text-lg tracking-tight">Active Queue</h1>
          </div>
          <UserButton />
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC]">
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
              <CheckCircle2 className="w-12 h-12 text-gray-400" />
              <p className="text-sm font-medium">Inbox is empty.</p>
            </div>
          ) : (
            tickets.map((t) => (
              <div
                key={t.$id}
                onClick={() => setSelectedTicket(t)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  selectedTicket?.$id === t.$id
                    ? 'bg-black border-black text-white shadow-lg'
                    : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md text-slate-800'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold flex items-center gap-2 truncate uppercase tracking-wider">
                    {t.sourceChannel === 'WHATSAPP' && <Phone className={`w-3.5 h-3.5 ${selectedTicket?.$id === t.$id ? 'text-[#8B2D75]' : 'text-emerald-500'}`} />}
                    {t.sourceChannel === 'EMAIL' && <Mail className={`w-3.5 h-3.5 ${selectedTicket?.$id === t.$id ? 'text-[#8B2D75]' : 'text-sky-500'}`} />}
                    {t.sourceChannel === 'IN_APP' && <MessageSquare className={`w-3.5 h-3.5 ${selectedTicket?.$id === t.$id ? 'text-[#8B2D75]' : 'text-indigo-500'}`} />}
                    <span className="truncate">{t.customerPhone || t.customerEmail || `Ticket #${t.$id.slice(-4)}`}</span>
                  </span>
                  
                  {/* Status Badge */}
                  <span
                    className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest shrink-0 ${
                      t.status === 'PENDING_AGENT'
                        ? 'bg-[#8B2D75] text-white animate-pulse'
                        : t.status === 'IN_PROGRESS'
                        ? 'bg-blue-600 text-white'
                        : selectedTicket?.$id === t.$id
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {t.status.replace('_', ' ')}
                  </span>
                </div>
                <p className={`text-sm truncate font-medium ${selectedTicket?.$id === t.$id ? 'text-gray-300' : 'text-gray-500'}`}>
                  {t.status === 'PENDING_AGENT' ? 'Needs human assistance...' : 'AI is handling conversation.'}
                </p>
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
            <header className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-white shadow-sm flex items-center justify-between z-10 shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setSelectedTicket(null)}
                  className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 text-black transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div>
                  <h2 className="font-bold text-black flex items-center gap-2 text-lg">
                    {selectedTicket.customerPhone || selectedTicket.customerEmail || `Client #${selectedTicket.$id.slice(-6)}`}
                  </h2>
                  <p className="text-xs font-semibold text-[#8B2D75] uppercase tracking-wider">
                    via {selectedTicket.sourceChannel}
                  </p>
                </div>
              </div>

              {/* Agent Actions */}
              {selectedTicket.status === 'IN_PROGRESS' && (
                <button 
                  onClick={handleEndChat}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-full text-xs font-bold uppercase tracking-wider transition-colors"
                >
                  <XCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">End Chat</span>
                </button>
              )}
            </header>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#F8FAFC]">
              
              {/* Private AI Summary Card */}
              {selectedTicket.aiSummary && (
                <div className="bg-[#FFF8FA] border border-[#8B2D75]/20 rounded-2xl p-4 shadow-sm mb-8 mx-auto max-w-2xl">
                  <div className="flex items-center gap-2 text-[#8B2D75] mb-2 font-bold text-xs uppercase tracking-wider">
                    <Info className="w-4 h-4" />
                    AI Handoff Summary (Private)
                  </div>
                  <p className="text-sm text-gray-800 leading-relaxed">
                    {selectedTicket.aiSummary}
                  </p>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.$id}
                  className={`flex flex-col ${
                    msg.senderType === 'AGENT' || msg.senderType === 'SYSTEM' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] md:max-w-[70%] p-4 text-[15px] shadow-sm flex flex-col ${
                      msg.senderType === 'AGENT'
                        ? 'bg-black text-white rounded-2xl rounded-tr-sm'
                        : msg.senderType === 'ASSISTANT'
                        ? 'bg-white text-black border border-gray-200 rounded-2xl rounded-tl-sm'
                        : msg.senderType === 'SYSTEM'
                        ? 'bg-gray-100 text-gray-600 rounded-2xl rounded-tr-sm text-center italic text-sm'
                        : 'bg-white text-black border border-gray-200 rounded-2xl rounded-tl-sm'
                    }`}
                  >
                    {msg.attachmentUrl && (
                      <img 
                        src={msg.attachmentUrl} 
                        alt="Attachment" 
                        className="mb-3 max-w-full rounded-xl border border-white/20" 
                      />
                    )}
                    <span className="leading-relaxed whitespace-pre-wrap">{msg.content}</span>
                    
                    {/* Sender Name bottom aligned */}
                    {msg.senderType !== 'SYSTEM' && (
                      <span className={`block text-[10px] font-bold mt-2 uppercase tracking-wider ${msg.senderType === 'AGENT' ? 'text-[#8B2D75] text-right' : 'text-[#8B2D75] text-left'}`}>
                        {msg.senderName}
                      </span>
                    )}
                  </div>
                </div>
              ))}

              {/* Real-time Typing Indicator */}
              {isCustomerTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex space-x-1.5 items-center">
                    <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area / Action Area */}
            <div className="p-3 md:p-4 bg-white border-t border-gray-100 shrink-0 pb-safe">
              {selectedTicket.status === 'PENDING_AGENT' ? (
                <button
                  onClick={handlePickTicket}
                  disabled={loading}
                  className="w-full py-4 bg-black hover:bg-gray-900 text-[#8B2D75] rounded-xl font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-lg flex items-center justify-center gap-3"
                >
                  <User className="w-5 h-5 text-white" />
                  <span className="text-white">Accept Chat Session</span>
                </button>
              ) : selectedTicket.status === 'IN_PROGRESS' ? (
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Type your reply to the customer..."
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    /* text-[16px] specifically prevents iOS Safari zooming */
                    className="flex-1 bg-[#F8FAFC] border border-gray-200 rounded-xl px-5 py-4 text-[16px] focus:outline-none focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent transition-all placeholder:text-gray-400"
                  />
                  <button
                    type="submit"
                    disabled={loading || !replyContent.trim()}
                    className="bg-black hover:bg-gray-900 text-[#8B2D75] px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              ) : (
                <div className="w-full py-4 bg-gray-50 text-gray-500 rounded-xl font-semibold uppercase tracking-widest flex items-center justify-center text-xs">
                  Ticket is currently controlled by AI
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-[#F8FAFC]">
            <div className="w-20 h-20 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm mb-6">
              <Bot className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-xl font-bold text-gray-800 tracking-tight">No conversation selected</p>
            <p className="text-sm font-medium mt-2">Select an active ticket from the queue.</p>
          </div>
        )}
      </div>
    </div>
  );
}
