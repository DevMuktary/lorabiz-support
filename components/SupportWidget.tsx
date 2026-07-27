"use client";

import React, { useState, useEffect, useRef } from 'react';
import { client, account, databases, storage } from '@/lib/appwrite-client';
import { Query, ID, Permission, Role } from 'appwrite';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
const TICKETS_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID || 'tickets';
const MESSAGES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';
const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || 'attachments';

interface Ticket {
  $id: string;
  title?: string;
  status: string;
  $createdAt: string;
}

interface Message {
  $id: string;
  senderType: 'CUSTOMER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  senderName: string;
  content: string;
  attachmentUrl?: string;
}

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<'HUB' | 'ONBOARDING' | 'CHAT'>('HUB');
  const [anonUserId, setAnonUserId] = useState<string | null>(null);
  const [historyTickets, setHistoryTickets] = useState<Ticket[]>([]);
  
  // Onboarding State
  const [userDetails, setUserDetails] = useState({ name: '', email: '' });
  
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Session & Load Saved Details
  useEffect(() => {
    const savedDetails = localStorage.getItem('lora_user_details');
    if (savedDetails) setUserDetails(JSON.parse(savedDetails));

    const initAnonSession = async () => {
      try {
        const currentUser = await account.get();
        setAnonUserId(currentUser.$id);
      } catch {
        const session = await account.createAnonymousSession();
        setAnonUserId(session.userId);
      }
    };
    initAnonSession();
  }, []);

  // Fetch Hub History
  useEffect(() => {
    if (!anonUserId || !isOpen || view !== 'HUB') return;
    databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
      Query.equal('sourceChannel', 'IN_APP'), Query.orderDesc('$createdAt'), Query.limit(5)
    ]).then(res => setHistoryTickets(res.documents as unknown as Ticket[]))
      .catch(console.error);
  }, [anonUserId, isOpen, view]);

  // Handle Realtime Messages
  useEffect(() => {
    if (view !== 'CHAT' || !activeTicketId) return;
    databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
      Query.equal('ticketId', activeTicketId), Query.orderAsc('$createdAt')
    ]).then(res => setMessages(res.documents as unknown as Message[]));

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${MESSAGES_COLLECTION_ID}.documents`,
      (response: any) => {
        if (response.events.includes('databases.*.collections.*.documents.*.create') && response.payload.ticketId === activeTicketId) {
          setMessages((prev) => prev.find((m) => m.$id === response.payload.$id) ? prev : [...prev, response.payload as Message]);
        }
      }
    );
    return () => unsubscribe();
  }, [activeTicketId, view]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, view]);

  const toggleWidget = (newState: boolean) => {
    setIsOpen(newState);
    if (newState && !activeTicketId) setView('HUB');
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage(newState ? 'LORA_WIDGET_OPENED' : 'LORA_WIDGET_CLOSED', '*');
    }
  };

  const handleStartChat = (existingTicketId?: string) => {
    if (existingTicketId) {
      setActiveTicketId(existingTicketId);
      setView('CHAT');
    } else {
      if (!userDetails.name || !userDetails.email) {
        setView('ONBOARDING');
      } else {
        setActiveTicketId(`TICKET_${Date.now()}`);
        setMessages([]);
        setView('CHAT');
      }
    }
  };

  const handleOnboardingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetails.name || !userDetails.email) return;
    localStorage.setItem('lora_user_details', JSON.stringify(userDetails));
    setActiveTicketId(`TICKET_${Date.now()}`);
    setMessages([]);
    setView('CHAT');
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !anonUserId || !activeTicketId) return;

    setIsTyping(true);
    let uploadedFileUrl = '';

    if (selectedFile) {
      setIsUploading(true);
      try {
        const upload = await storage.createFile(
          BUCKET_ID, ID.unique(), selectedFile, 
          [Permission.read(Role.user(anonUserId)), Permission.read(Role.team('agents'))]
        );
        uploadedFileUrl = storage.getFileView(BUCKET_ID, upload.$id);
      } catch (err) {
        alert("File upload failed.");
        setIsUploading(false); setIsTyping(false); return;
      }
      setIsUploading(false); setSelectedFile(null);
    }

    const currentText = inputText;
    setInputText(''); 

    setMessages((prev) => [...prev, {
      $id: `temp_${Date.now()}`, senderType: 'CUSTOMER', senderName: userDetails.name || 'You',
      content: currentText, attachmentUrl: uploadedFileUrl
    }]);

    try {
      await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicketId, message: currentText, senderId: anonUserId,
          senderName: userDetails.name, customerEmail: userDetails.email, attachmentUrl: uploadedFileUrl
        }),
      });
    } catch (error) {
      console.error('Chat Error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    // FIX: Removed width/height restrictions on the root to ensure mobile fullscreen sizing works
    <div className="fixed inset-0 sm:inset-auto sm:bottom-0 sm:right-0 z-[99999] flex flex-col items-end sm:p-6 pointer-events-none">
      {isOpen && (
        <div className="w-full h-full sm:w-[400px] sm:h-[650px] sm:mb-4 bg-white sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden pointer-events-auto border-0 sm:border border-gray-200 animate-in slide-in-from-bottom-5">
          
          <div className="bg-[#000000] px-5 py-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center space-x-3">
              {(view === 'CHAT' || view === 'ONBOARDING') && (
                <button onClick={() => setView('HUB')} className="hover:bg-white/10 p-1 rounded-md transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              <div className="w-2.5 h-2.5 rounded-full bg-[#8B2D75] animate-pulse"></div>
              <h3 className="font-bold text-[16px] tracking-wide text-white">LoraBiz Support</h3>
            </div>
            <button onClick={() => toggleWidget(false)} className="text-gray-300 hover:text-white p-1">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          {/* HUB VIEW */}
          {view === 'HUB' && (
             <div className="flex-1 overflow-y-auto bg-[#F8FAFC] p-5 flex flex-col space-y-6">
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <div className="w-14 h-14 rounded-full bg-yellow-400 flex items-center justify-center shrink-0 border-2 border-[#8B2D75]">
                   <svg className="w-8 h-8 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M16 11V9a4 4 0 0 0-8 0v2" /><circle cx="12" cy="11" r="3" fill="currentColor" /><path d="M8 11h-.5a1.5 1.5 0 0 0-1.5 1.5v2A1.5 1.5 0 0 0 7.5 16H8" /><path d="M16 11h.5a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5H16" /><path d="M17.5 14.5c0 1.5-2 3-5.5 3" /></svg>
                </div>
                <div>
                  <h2 className="text-[18px] font-extrabold text-black tracking-tight">Hi there!</h2>
                  <p className="text-[14px] text-gray-600 leading-snug">I'm Lora. How can we help you today?</p>
                </div>
              </div>

              <div className="space-y-3">
                <button onClick={() => handleStartChat()} className="w-full flex items-center justify-between bg-[#8B2D75] hover:bg-[#722360] text-white p-4 rounded-xl shadow-md transition-transform active:scale-95">
                  <span className="font-bold text-[16px]">Send us a message</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>

              {historyTickets.length > 0 && (
                <div>
                  <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400 mb-3">Recent Conversations</h3>
                  <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                    {historyTickets.map((t) => (
                      <button key={t.$id} onClick={() => handleStartChat(t.$id)} className="w-full text-left p-4 border-b last:border-0 hover:bg-gray-50 flex items-center justify-between">
                        <div className="truncate pr-4">
                          <p className="text-[15px] font-semibold text-gray-800 truncate">{t.title || 'Support Request'}</p>
                          <p className="text-[12px] text-gray-500 mt-0.5">{new Date(t.$createdAt).toLocaleDateString()}</p>
                        </div>
                        <span className="shrink-0 text-[#8B2D75]"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ONBOARDING VIEW */}
          {view === 'ONBOARDING' && (
            <div className="flex-1 overflow-y-auto bg-white p-6 flex flex-col justify-center">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's get started</h2>
                <p className="text-gray-500 text-sm">Please provide your details so we can assist you better and reach out if we get disconnected.</p>
              </div>
              <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                  <input required type="text" value={userDetails.name} onChange={(e) => setUserDetails({...userDetails, name: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-[16px] focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent outline-none" placeholder="John Doe" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Registered Email</label>
                  <input required type="email" value={userDetails.email} onChange={(e) => setUserDetails({...userDetails, email: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-[16px] focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent outline-none" placeholder="john@example.com" />
                </div>
                <button type="submit" className="w-full bg-[#000000] text-white font-bold py-3.5 rounded-lg hover:bg-gray-800 transition-colors mt-4">
                  Start Chat
                </button>
              </form>
            </div>
          )}

          {/* CHAT VIEW */}
          {view === 'CHAT' && (
             // ... [The Chat Feed rendering remains exactly identical as before] ...
             <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC]">
               <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5 relative">
                  {/* Map Messages */}
                  {messages.map((msg) => {
                    const isUser = msg.senderType === 'CUSTOMER';
                    const isSystem = msg.senderType === 'SYSTEM';

                    if (isSystem) return (
                      <div key={msg.$id} className="text-center my-3">
                        <span className="text-[13px] text-gray-500 font-medium bg-gray-200 px-4 py-1.5 rounded-full">{msg.content}</span>
                      </div>
                    );

                    return (
                      <div key={msg.$id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed shadow-sm ${
                            isUser ? 'bg-[#000000] text-white rounded-br-sm' : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                          }`}>
                          {msg.attachmentUrl && <img src={msg.attachmentUrl} alt="Attachment" className="mb-2 max-w-full rounded-lg object-cover max-h-[200px]" />}
                          {msg.content && <span>{msg.content}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-5 py-4 flex space-x-1.5 items-center">
                        <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce"></div><div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div><div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
               </div>

               {/* Input Area */}
               <div className="p-3 sm:p-4 bg-white border-t border-gray-200 shrink-0 pb-safe">
                 <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-[#8B2D75]">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                    </button>
                    <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Message..." className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-[16px] rounded-xl p-3.5 focus:ring-[#000000] focus:border-[#000000]" />
                    <button type="submit" disabled={(!inputText.trim() && !selectedFile) || isTyping || isUploading} className="p-3.5 bg-[#000000] text-[#8B2D75] rounded-xl disabled:opacity-50">
                      {isUploading ? <div className="w-6 h-6 border-2 border-[#8B2D75] border-t-transparent rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                    </button>
                 </form>
               </div>
             </div>
          )}
        </div>
      )}

      {/* FIX: Zoho-Style Human Headset Launcher Icon */}
      <div className="absolute bottom-6 right-6 sm:relative sm:bottom-0 sm:right-0 sm:p-0 pointer-events-auto">
        <button
          onClick={() => toggleWidget(!isOpen)}
          className={`w-[75px] h-[75px] rounded-full shadow-[0_10px_30px_rgba(0,0,0,0.3)] flex items-center justify-center transition-transform hover:scale-105 active:scale-95 border-2 ${isOpen ? 'bg-black border-transparent' : 'bg-white border-[#8B2D75]'}`}
        >
          {isOpen ? (
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            // A realistic, high-quality image of a human with a headset (Zoho Style)
            <img 
              src="https://images.unsplash.com/photo-1596524430615-b46475ddff6e?auto=format&fit=crop&w=150&q=80" 
              alt="Chat with us" 
              className="w-full h-full object-cover rounded-full p-0.5"
            />
          )}
        </button>
      </div>
    </div>
  );
}
