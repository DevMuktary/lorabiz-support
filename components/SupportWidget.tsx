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
  const [view, setView] = useState<'HUB' | 'CHAT'>('HUB');
  const [anonUserId, setAnonUserId] = useState<string | null>(null);
  const [historyTickets, setHistoryTickets] = useState<Ticket[]>([]);
  
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Anonymous Appwrite Session
  useEffect(() => {
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

  // Fetch Hub History (Only loads tickets this user created due to DLS)
  useEffect(() => {
    if (!anonUserId || !isOpen || view !== 'HUB') return;
    
    const loadHistory = async () => {
      try {
        const response = await databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION_ID, [
          Query.equal('sourceChannel', 'IN_APP'),
          Query.orderDesc('$createdAt'),
          Query.limit(5)
        ]);
        setHistoryTickets(response.documents as unknown as Ticket[]);
      } catch (err) {
        console.error("Failed to load history", err);
      }
    };
    loadHistory();
  }, [anonUserId, isOpen, view]);

  // Handle Realtime Chat Messages
  useEffect(() => {
    if (view !== 'CHAT' || !activeTicketId) return;

    // Load past messages for this ticket
    databases.listDocuments(DATABASE_ID, MESSAGES_COLLECTION_ID, [
      Query.equal('ticketId', activeTicketId), Query.orderAsc('$createdAt')
    ]).then(res => setMessages(res.documents as unknown as Message[]));

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${MESSAGES_COLLECTION_ID}.documents`,
      (response: any) => {
        if (response.events.includes('databases.*.collections.*.documents.*.create') && response.payload.ticketId === activeTicketId) {
          setMessages((prev) => {
            if (prev.find((m) => m.$id === response.payload.$id)) return prev;
            return [...prev, response.payload as Message];
          });
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
    
    // Notify the host website to expand/contract the iframe container
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage(
        newState ? 'LORA_WIDGET_OPENED' : 'LORA_WIDGET_CLOSED', 
        '*' 
      );
    }
  };

  const handleStartChat = (existingTicketId?: string) => {
    if (existingTicketId) {
      setActiveTicketId(existingTicketId);
    } else {
      setActiveTicketId(`TICKET_${Date.now()}`);
      setMessages([]);
    }
    setView('CHAT');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert("File must be less than 5MB");
        return;
      }
      setSelectedFile(file);
    }
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
          BUCKET_ID, 
          ID.unique(), 
          selectedFile, 
          [Permission.read(Role.user(anonUserId)), Permission.read(Role.team('agents'))]
        );
        // Typescript Build Fix: getFileView returns a string URL directly in the web SDK
        uploadedFileUrl = storage.getFileView(BUCKET_ID, upload.$id);
      } catch (err) {
        console.error("Upload failed", err);
        alert("File upload failed.");
        setIsUploading(false);
        setIsTyping(false);
        return;
      }
      setIsUploading(false);
      setSelectedFile(null);
    }

    const currentText = inputText;
    setInputText(''); 

    // Optimistic UI Update
    setMessages((prev) => [...prev, {
      $id: `temp_${Date.now()}`, senderType: 'CUSTOMER', senderName: 'You',
      content: currentText, attachmentUrl: uploadedFileUrl
    }]);

    try {
      await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicketId, message: currentText, senderId: anonUserId, attachmentUrl: uploadedFileUrl
        }),
      });
    } catch (error) {
      console.error('Chat Error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-0 right-0 z-[99999] flex flex-col items-end p-0 sm:p-6 w-full h-[100dvh] sm:h-auto sm:w-auto pointer-events-none">
      {isOpen && (
        <div className="w-full h-full sm:w-[400px] sm:h-[650px] sm:mb-4 bg-white sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden pointer-events-auto border border-gray-200 animate-in slide-in-from-bottom-5">
          
          {/* Header */}
          <div className="bg-[#000000] px-5 py-4 flex justify-between items-center text-white shrink-0">
            <div className="flex items-center space-x-3">
              {view === 'CHAT' && (
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
              
              {/* Upgraded Welcome Card */}
              <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <img 
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=150&q=80" 
                  alt="Support Agent" 
                  className="w-14 h-14 rounded-full object-cover shadow-sm border-2 border-[#8B2D75]"
                />
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
                
                <div className="flex gap-3">
                  <a href="https://wa.me/YOUR_NUMBER" target="_blank" rel="noreferrer" className="flex-1 bg-white border border-gray-200 p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors pointer-events-auto">
                    <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                    <span className="text-[14px] font-bold text-gray-800">WhatsApp</span>
                  </a>
                  <a href="mailto:support@lorabiz.com" className="flex-1 bg-white border border-gray-200 p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors pointer-events-auto">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <span className="text-[14px] font-bold text-gray-800">Email</span>
                  </a>
                </div>
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
                        <span className="shrink-0 text-[#8B2D75]">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="text-center mt-auto pt-6">
                 <p className="text-[11px] text-gray-400">By messaging us, you agree to our privacy policy and terms.</p>
              </div>
            </div>
          )}

          {/* CHAT VIEW */}
          {view === 'CHAT' && (
            <>
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#F8FAFC] space-y-5 relative">
                {messages.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-center p-6 text-gray-500 text-[15px]">
                    <p>Send a message or an image to start chatting with Lora, our AI assistant.</p>
                  </div>
                )}

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
                        {msg.attachmentUrl && (
                          <img src={msg.attachmentUrl} alt="Attachment" className="mb-2 max-w-full rounded-lg object-cover max-h-[200px]" />
                        )}
                        {msg.content && <span>{msg.content}</span>}
                      </div>
                    </div>
                  );
                })}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-5 py-4 flex space-x-1.5 items-center">
                      <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                      <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="p-3 sm:p-4 bg-white border-t border-gray-200 shrink-0 pb-safe">
                {selectedFile && (
                  <div className="mb-3 relative inline-block">
                    <div className="bg-gray-100 rounded-lg p-2 pr-8 text-[13px] font-medium text-gray-700 flex items-center gap-2">
                       <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                       <span className="truncate max-w-[150px]">{selectedFile.name}</span>
                    </div>
                    <button onClick={() => setSelectedFile(null)} className="absolute top-1 right-1 bg-red-100 text-red-600 rounded-full p-1 hover:bg-red-200">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                  <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/jpeg, image/png, image/svg+xml, application/pdf" />
                  
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-[#8B2D75] hover:bg-gray-100 rounded-xl transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Message..."
                    className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-[16px] rounded-xl focus:ring-[#000000] focus:border-[#000000] block w-full p-3.5"
                  />
                  <button
                    type="submit"
                    disabled={(!inputText.trim() && !selectedFile) || isTyping || isUploading}
                    className="p-3.5 bg-[#000000] text-[#8B2D75] rounded-xl hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {isUploading ? (
                      <div className="w-6 h-6 border-2 border-[#8B2D75] border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                    )}
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {/* Human Agent Launcher Button */}
      <div className="sm:p-0 p-4 pointer-events-auto">
        <button
          onClick={() => toggleWidget(!isOpen)}
          className="w-[85px] h-[85px] bg-transparent flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        >
          {isOpen ? (
            // Close State (Simple circle with X)
            <div className="w-[60px] h-[60px] bg-black text-white rounded-full flex items-center justify-center shadow-2xl">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          ) : (
            // Custom Human Agent Avatar (Yellow shirt, Headset, No Background)
            <svg className="w-[85px] h-[85px] drop-shadow-[0_10px_20px_rgba(0,0,0,0.25)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="48" fill="white" className="opacity-0"/> 
              
              {/* Yellow Shirt */}
              <path d="M15 100 C 15 65, 85 65, 85 100" fill="#FACC15" />
              
              {/* Neck */}
              <path d="M40 70 L 40 80 L 60 80 L 60 70 Z" fill="#FDBA74" />
              
              {/* Head */}
              <circle cx="50" cy="45" r="25" fill="#FDBA74" />
              
              {/* Hair */}
              <path d="M25 45 C 25 15, 75 15, 75 45 C 75 25, 60 18, 50 18 C 40 18, 25 25, 25 45 Z" fill="#1F2937" />
              
              {/* Face Details */}
              <circle cx="41" cy="43" r="3" fill="#1F2937" />
              <circle cx="59" cy="43" r="3" fill="#1F2937" />
              <path d="M44 55 Q 50 61 56 55" stroke="#1F2937" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
              
              {/* Headset Band */}
              <path d="M20 45 C 20 10, 80 10, 80 45" stroke="#4B5563" strokeWidth="4" fill="none" />
              
              {/* Earpads */}
              <rect x="74" y="35" width="10" height="20" rx="5" fill="#374151" />
              <rect x="16" y="35" width="10" height="20" rx="5" fill="#374151" />
              
              {/* Mic Boom */}
              <path d="M79 50 C 79 65, 65 68, 58 65" stroke="#374151" strokeWidth="3" strokeLinecap="round" fill="none"/>
              
              {/* Mic Sponge */}
              <circle cx="56" cy="64" r="4" fill="#EF4444" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
