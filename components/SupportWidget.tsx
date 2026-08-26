"use client";

import React, { useState, useEffect, useRef } from 'react';
import { storage } from '@/lib/appwrite-client';
import { ID } from 'appwrite';

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

interface CustomDialog {
  isOpen: boolean;
  type: 'alert' | 'confirm';
  title: string;
  message: string;
  onConfirm?: () => void;
}

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0); 
  const [view, setView] = useState<'HUB' | 'ONBOARDING' | 'CHAT'>('HUB');
  
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [userDetails, setUserDetails] = useState({ name: '', email: '', topic: '', description: '' });
  
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [historyTickets, setHistoryTickets] = useState<Ticket[]>([]);
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const [dialog, setDialog] = useState<CustomDialog | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Refs for tracking state inside background polls without triggering infinite loops
  const isOpenRef = useRef(isOpen);
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  const historyTicketsRef = useRef(historyTickets);
  useEffect(() => { historyTicketsRef.current = historyTickets; }, [historyTickets]);

  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  // Track messages in a ref for accurate unread counting
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const handleParentMessage = (event: MessageEvent) => {
      if (event.data === 'LORA_TOGGLE_OPEN') {
        toggleWidget(true);
      } else if (event.data === 'LORA_TOGGLE_CLOSE') {
        toggleWidget(false);
      }
    };
    window.addEventListener('message', handleParentMessage);
    return () => window.removeEventListener('message', handleParentMessage);
  }, []);

  useEffect(() => {
    const initFromUrl = async () => {
      const params = new URLSearchParams(window.location.search);
      const urlUserId = params.get('userId');
      
      if (urlUserId) {
        setAuthUserId(urlUserId);
        setUserDetails(prev => ({ 
          ...prev, 
          name: params.get('name') || prev.name, 
          email: params.get('email') || prev.email 
        }));

        try {
          const res = await fetch('/api/support/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'INIT_SESSION', userId: urlUserId })
          });
          const data = await res.json();
          
          if (data.status === 'SUCCESS' || data.status === 'NO_ACTIVE_TICKET') {
            if (data.allTickets) setHistoryTickets(data.allTickets);
            if (data.ticketId) {
              setActiveTicketId(data.ticketId);
              const msgs = data.messages || [];
              setMessages(msgs);

              // Check unread count on initial load if widget is closed
              if (!isOpenRef.current && msgs.length > 0) {
                try {
                  const lastReadStr = typeof window !== 'undefined' ? localStorage.getItem(`lorabiz_last_read_${urlUserId || 'guest'}`) : null;
                  const lastReadTime = lastReadStr ? parseInt(lastReadStr, 10) : 0;
                  const incomingMsgs = msgs.filter((m: any) => m.senderType !== 'CUSTOMER');
                  
                  if (lastReadTime > 0) {
                    const unread = incomingMsgs.filter((m: any) => new Date(m.$createdAt).getTime() > lastReadTime);
                    setUnreadCount(unread.length);
                  } else if (incomingMsgs.length > 0) {
                    setUnreadCount(Math.min(incomingMsgs.length, 9));
                  }
                } catch (e) {}
              }
            }
          }
        } catch (err) {}
      }
      setIsInitializing(false);
    };

    initFromUrl();
  }, []);

  useEffect(() => {
    if (!activeTicketId) return;

    let intervalId: NodeJS.Timeout;

    const fetchChatHistory = async () => {
      try {
        const res = await fetch('/api/support/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'FETCH_HISTORY', ticketId: activeTicketId })
        });
        const data = await res.json();
        
        if (data.messages) {
          const prevIds = new Set(messagesRef.current.map(m => m.$id));
          const newMsgs = data.messages.filter((m: any) => !prevIds.has(m.$id));
          const newReplies = newMsgs.filter((m: any) => m.senderType !== 'CUSTOMER');
          
          // 🚀 Smart Unread Counter Logic 🚀
          if (!isOpenRef.current && data.messages.length > 0) {
              if (messagesRef.current.length === 0) {
                  const incoming = data.messages.filter((m: any) => m.senderType !== 'CUSTOMER');
                  if (incoming.length > 0) {
                      setUnreadCount(incoming.length);
                  }
              } else if (newReplies.length > 0) {
                  setUnreadCount(count => count + newReplies.length);
              }
          }

          setMessages(prev => {
             const serverIds = new Set(data.messages.map((m: any) => m.$id));
             const inFlight = prev.filter(m => !serverIds.has(m.$id) && m.senderType === 'CUSTOMER');
             return [...data.messages, ...inFlight];
          });
          
          setIsChatLoading(false); 
          
          if (data.ticketStatus) {
            if (data.ticketStatus === 'CLOSED') {
               clearInterval(intervalId); // Stop polling
            }

            setHistoryTickets(prev => {
              const exists = prev.find(t => t.$id === activeTicketId);
              if (exists) return prev.map(t => t.$id === activeTicketId ? { ...t, status: data.ticketStatus } : t);
              return [{ $id: activeTicketId, status: data.ticketStatus, $createdAt: new Date().toISOString() }, ...prev];
            });
          }
        }
      } catch (err) {
         setIsChatLoading(false); 
      }
    };
    
    fetchChatHistory(); // Always fetch instantly when a ticket is clicked
    intervalId = setInterval(fetchChatHistory, 3000); 
    
    return () => clearInterval(intervalId);
  }, [activeTicketId]);

  const scrollToBottom = () => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 150);
  };
  useEffect(() => { scrollToBottom(); }, [messages.length, isTyping, view, isOpen]);

  const markAsRead = () => {
    setUnreadCount(0);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`lorabiz_last_read_${authUserId || 'guest'}`, Date.now().toString());
      }
    } catch (e) {}
  };

  const toggleWidget = (newState: boolean) => {
    setIsOpen(newState);
    if (newState) {
      markAsRead();
      if (!activeTicketId) setView('HUB');
    }
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage(newState ? 'LORA_WIDGET_OPENED' : 'LORA_WIDGET_CLOSED', '*');
    }
  };

  const openTicket = historyTickets.find(t => t.status !== 'CLOSED');

  const handleStartChat = () => {
    if (openTicket) {
      setMessages([]); 
      setIsChatLoading(true);
      setActiveTicketId(openTicket.$id);
      setView('CHAT');
    } else {
      setUserDetails(prev => ({ ...prev, topic: '', description: '' }));
      setView('ONBOARDING');
    }
  };

  const handleOpenHistory = (ticketId: string) => {
    setMessages([]); 
    setIsChatLoading(true);
    setActiveTicketId(ticketId);
    setView('CHAT');
  };

  const handleEndChat = () => {
    if (!activeTicketId) return;
    
    setDialog({
      isOpen: true,
      type: 'confirm',
      title: 'End Conversation',
      message: 'Are you sure you want to end this chat? It will be permanently closed.',
      onConfirm: async () => {
        setDialog(null);
        setView('HUB');
        setHistoryTickets(prev => prev.map(t => t.$id === activeTicketId ? { ...t, status: 'CLOSED' } : t));
        const closingTicketId = activeTicketId;
        setActiveTicketId(null);

        try {
          await fetch('/api/support/chat', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'CLOSE_TICKET', ticketId: closingTicketId })
          });
        } catch (err) {}
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (e.target.files[0].size > 5 * 1024 * 1024) { 
        setDialog({ isOpen: true, type: 'alert', title: 'File Too Large', message: 'Attachment must be less than 5MB.' });
        return; 
      }
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetails.name || !userDetails.email || !userDetails.topic) return;
    
    const newTicketId = `TICKET_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
    setActiveTicketId(newTicketId);
    setMessages([]);
    setView('CHAT');
    setIsTyping(true);

    try {
      const systemContextMessage = `[System: Customer Onboarded]\nName: ${userDetails.name}\nEmail: ${userDetails.email}\nTopic: ${userDetails.topic}\nDescription: ${userDetails.description}`;

      await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticketId: newTicketId, userId: authUserId, message: systemContextMessage, senderName: userDetails.name, customerEmail: userDetails.email 
        }),
      });
      setHistoryTickets(prev => [{ $id: newTicketId, status: 'OPEN', $createdAt: new Date().toISOString(), title: userDetails.topic }, ...prev]);
    } catch (error) {} finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputText.trim() && !selectedFile) || !activeTicketId) return;

    const currentText = inputText;
    const messageId = ID.unique(); 
    setInputText(''); 
    
    setMessages((prev) => [...prev, {
      $id: messageId, senderType: 'CUSTOMER', senderName: userDetails.name || 'You',
      content: currentText, attachmentUrl: selectedFile ? URL.createObjectURL(selectedFile) : undefined
    }]);
    
    setIsTyping(true);
    let uploadedFileUrl = '';

    if (selectedFile) {
      setIsUploading(true);
      try {
        // 🚀 THE FIX: Removed Role.team('agents') so it successfully uploads using default permissions!
        const upload = await storage.createFile(BUCKET_ID, ID.unique(), selectedFile);
        uploadedFileUrl = storage.getFileView(BUCKET_ID, upload.$id);
      } catch (err) {
        setDialog({ isOpen: true, type: 'alert', title: 'Upload Failed', message: 'There was an error attaching your file. Please try again.' });
      }
      setIsUploading(false); setSelectedFile(null);
    }

    try {
      await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticketId: activeTicketId, messageId, userId: authUserId, message: currentText, senderName: userDetails.name, attachmentUrl: uploadedFileUrl 
        }),
      });
    } catch (error) {
      setMessages(prev => prev.filter(m => m.$id !== messageId));
    } finally {
      setIsTyping(false);
    }
  };

  const closedTickets = historyTickets.filter(t => t.status === 'CLOSED').slice(0, 3);
  const isViewingClosedTicket = historyTickets.find(t => t.$id === activeTicketId)?.status === 'CLOSED';

  return (
    <div className={`w-full h-full ${isOpen ? 'fixed inset-0 sm:inset-auto sm:bottom-0 sm:right-0 z-[99999] flex flex-col items-end sm:p-6 pointer-events-none' : 'flex items-center justify-center p-2 pointer-events-auto select-none'}`}>
      
      {/* 🚀 IMAGE LIGHTBOX MODAL 🚀 */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in pointer-events-auto" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <img src={lightboxImage} alt="Enlarged Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {isOpen && (
        <div className="w-full h-full sm:w-[400px] sm:h-[650px] sm:mb-4 bg-white sm:rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden pointer-events-auto border-0 sm:border border-gray-200 animate-in slide-in-from-bottom-5 relative overscroll-contain">
          
          {dialog?.isOpen && (
            <div className="absolute inset-0 z-[100] bg-black/40 flex items-center justify-center p-4 backdrop-blur-[2px] animate-in fade-in duration-200">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] p-6 animate-in zoom-in-95 duration-200">
                <h3 className="text-[17px] font-extrabold text-gray-900 mb-2">{dialog.title}</h3>
                <p className="text-[14px] text-gray-600 mb-6 leading-relaxed">{dialog.message}</p>
                <div className="flex justify-end gap-3">
                  {dialog.type === 'confirm' && (
                    <button onClick={() => setDialog(null)} className="px-4 py-2 text-[13px] font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                  )}
                  <button 
                    onClick={() => {
                      if (dialog.type === 'confirm' && dialog.onConfirm) { dialog.onConfirm(); } 
                      else { setDialog(null); }
                    }}
                    className="px-5 py-2.5 text-[13px] font-bold text-white bg-[#000000] hover:bg-gray-800 rounded-xl transition-transform active:scale-95"
                  >
                    {dialog.type === 'confirm' ? 'Yes, End Chat' : 'Okay'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-[#000000] px-5 py-4 flex justify-between items-center text-white shrink-0 z-10">
            <div className="flex items-center space-x-3">
              {(view === 'CHAT' || view === 'ONBOARDING') && (
                <button onClick={() => { setView('HUB'); setActiveTicketId(null); }} className="hover:bg-white/10 p-1 rounded-md transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              <div className={`w-2.5 h-2.5 rounded-full bg-[#8B2D75] ${!isViewingClosedTicket && !isInitializing ? 'animate-pulse' : ''}`}></div>
              <h3 className="font-bold text-[16px] tracking-wide text-white">LoraBiz Support</h3>
            </div>
            
            <div className="flex items-center space-x-2">
              {view === 'CHAT' && !isViewingClosedTicket && !isChatLoading && (
                <button onClick={handleEndChat} className="text-[12px] font-bold bg-[#333333] hover:bg-red-600 text-white px-2.5 py-1.5 rounded-md transition-colors shadow-sm">End Chat</button>
              )}
              <button onClick={() => toggleWidget(false)} className="text-gray-300 hover:text-white p-1 ml-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {isInitializing ? (
             <div className="flex-1 flex flex-col items-center justify-center bg-[#F8FAFC] space-y-5">
               <div className="w-20 h-20 rounded-full bg-white flex items-center justify-center p-2 shadow-sm border border-gray-100 animate-pulse">
                  <img src="/support.png" alt="Loading" className="w-full h-full object-contain opacity-70" />
               </div>
               <div className="text-center animate-pulse"><h2 className="text-[17px] font-bold text-gray-800">Connecting securely...</h2></div>
               <div className="flex space-x-2 mt-2">
                  <div className="w-2.5 h-2.5 bg-[#8B2D75] rounded-full animate-bounce"></div><div className="w-2.5 h-2.5 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div><div className="w-2.5 h-2.5 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
             </div>
          ) : (
            <>
              {view === 'HUB' && (
                <div className="flex-1 overflow-y-auto overscroll-contain bg-[#F8FAFC] p-5 flex flex-col space-y-6">
                  <div className="flex items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                    <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center shrink-0 border border-gray-200 shadow-sm p-1">
                      <img src="/support.png" alt="Agent" className="w-full h-full object-contain" />
                    </div>
                    <div>
                      <h2 className="text-[18px] font-extrabold text-black tracking-tight">Hi {userDetails.name ? userDetails.name.split(' ')[0] : 'there'}!</h2>
                      <p className="text-[14px] text-gray-600 leading-snug">I'm Lora. How can we help you today?</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {openTicket ? (
                      <button onClick={() => handleStartChat()} className="w-full flex items-center justify-between bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl shadow-md transition-transform active:scale-95">
                        <span className="font-bold text-[16px]">Resume Active Chat</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </button>
                    ) : (
                      <button onClick={() => handleStartChat()} className="w-full flex items-center justify-between bg-[#8B2D75] hover:bg-[#722360] text-white p-4 rounded-xl shadow-md transition-transform active:scale-95">
                        <span className="font-bold text-[16px]">Start a new conversation</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </button>
                    )}
                    
                    <div className="flex gap-3">
                      <a href="https://wa.me/YOUR_NUMBER" target="_blank" rel="noreferrer" className="flex-1 bg-white border border-gray-200 p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors pointer-events-auto cursor-pointer relative z-10">
                        <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12.031 0c-6.627 0-12.002 5.373-12.002 11.996 0 2.115.549 4.184 1.593 6.002l-1.622 5.952 6.096-1.597c1.764.957 3.754 1.464 5.935 1.464 6.627 0 12.001-5.372 12.001-11.996 0-6.623-5.374-11.996-12.001-11.996zm6.386 17.202c-.267.755-1.545 1.458-2.128 1.528-.544.066-1.25.138-3.593-.83-2.827-1.171-4.636-4.048-4.773-4.225-.138-.178-1.139-1.517-1.139-2.894 0-1.378.716-2.053.966-2.319.251-.267.545-.334.726-.334.18 0 .361 0 .513.009.157.009.378-.059.589.445.213.504.726 1.766.793 1.899.066.134.11.293.02.471-.09.178-.138.289-.276.446-.138.156-.29.356-.414.489-.138.156-.289.324-.124.624.164.298.726 1.218 1.554 2.046 1.066 1.064 1.975 1.385 2.274 1.519.298.134.471.111.647-.067.178-.178.761-.885.966-1.189.205-.304.41-.253.682-.156.273.098 1.722.815 2.019.964.298.148.497.223.57.347.074.124.074.726-.193 1.48z"/>
                        </svg>
                        <span className="text-[14px] font-bold text-gray-800">WhatsApp</span>
                      </a>
                      <a href="mailto:help@support.lorabiz.com" target="_top" className="flex-1 bg-white border border-gray-200 p-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors pointer-events-auto cursor-pointer relative z-10">
                        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        <span className="text-[14px] font-bold text-gray-800">Email</span>
                      </a>
                    </div>
                  </div>

                  {closedTickets.length > 0 && (
                    <div className="mt-2 border-t border-gray-200 pt-5">
                      <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400 mb-3">Previous Conversations</h3>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto overscroll-contain pr-1">
                        {closedTickets.map(ticket => (
                          <button key={ticket.$id} onClick={() => handleOpenHistory(ticket.$id)} className="w-full text-left bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors flex flex-col gap-1">
                            <span className="font-bold text-[14px] text-gray-800 truncate">{ticket.title || 'Support Request'}</span>
                            <span className="text-[12px] font-medium text-gray-500">Closed • {new Date(ticket.$createdAt).toLocaleDateString()}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-2 border-t border-gray-200 pt-5 pb-4">
                    <h3 className="text-[13px] font-bold uppercase tracking-wider text-gray-400 mb-4">Frequently Asked Questions</h3>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-[14px] font-bold text-gray-800">When can I chat with a support agent?</h4>
                        <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">Our human support team is available during standard business hours to assist you directly.</p>
                      </div>
                      <div>
                        <h4 className="text-[14px] font-bold text-gray-800">Will I get support outside working hours?</h4>
                        <p className="text-[13px] text-gray-600 mt-1 leading-relaxed">Yes, absolutely! Lora, our advanced AI assistant, is online 24/7 to resolve your inquiries instantly.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {view === 'ONBOARDING' && (
                <div className="flex-1 overflow-y-auto overscroll-contain bg-white p-6 flex flex-col justify-start">
                  <div className="text-center mb-6 mt-4">
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Let's get started</h2>
                    <p className="text-gray-500 text-sm">Please select a topic so we can assist you better.</p>
                  </div>
                  <form onSubmit={handleOnboardingSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Your Name</label>
                      <input required type="text" value={userDetails.name} onChange={(e) => setUserDetails({...userDetails, name: e.target.value})} readOnly={!!authUserId} className={`w-full border border-gray-300 rounded-lg p-3 text-[16px] focus:ring-2 focus:ring-[#8B2D75] outline-none ${authUserId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholder="John Doe" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Registered Email</label>
                      <input required type="email" value={userDetails.email} onChange={(e) => setUserDetails({...userDetails, email: e.target.value})} readOnly={!!authUserId} className={`w-full border border-gray-300 rounded-lg p-3 text-[16px] focus:ring-2 focus:ring-[#8B2D75] outline-none ${authUserId ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholder="john@example.com" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Select a Service</label>
                      <select required value={userDetails.topic} onChange={(e) => setUserDetails({...userDetails, topic: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-[16px] focus:ring-2 focus:ring-[#8B2D75] outline-none bg-white">
                        <option value="" disabled>Choose a topic...</option>
                        <option value="CAC Biz/LLC Registration">CAC Biz/LLC Registration</option>
                        <option value="NIN Slip Generation">NIN Slip Generation</option>
                        <option value="Airtime & Data Bundle">Airtime & Data Bundle</option>
                        <option value="Tax ID Generation">Tax ID Generation</option>
                        <option value="Account Creation Issue">Account Creation Issue</option>
                        <option value="Login Issue">Login Issue</option>
                        <option value="Other / General Support">Other / General Support</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Briefly describe your issue</label>
                      <textarea rows={2} value={userDetails.description} onChange={(e) => setUserDetails({...userDetails, description: e.target.value})} className="w-full border border-gray-300 rounded-lg p-3 text-[16px] focus:ring-2 focus:ring-[#8B2D75] outline-none resize-none" placeholder="How can we help?"></textarea>
                    </div>
                    <button type="submit" className="w-full bg-[#000000] text-white font-bold py-3.5 rounded-lg hover:bg-gray-800 transition-colors mt-2">Start Chat</button>
                  </form>
                </div>
              )}

              {view === 'CHAT' && (
                 <div className="flex-1 flex flex-col min-h-0 bg-[#F8FAFC]">
                   
                   {isChatLoading ? (
                     <div className="flex-1 p-5 flex flex-col space-y-4">
                       <div className="flex justify-start animate-pulse"><div className="bg-gray-200 w-2/3 h-12 rounded-2xl rounded-bl-sm"></div></div>
                       <div className="flex justify-end animate-pulse mt-4"><div className="bg-gray-300 w-1/2 h-10 rounded-2xl rounded-br-sm"></div></div>
                       <div className="flex justify-start animate-pulse mt-4"><div className="bg-gray-200 w-3/4 h-16 rounded-2xl rounded-bl-sm"></div></div>
                     </div>
                   ) : (
                     <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-5 relative custom-scrollbar">
                        {messages.map((msg) => {
                          const isUser = msg.senderType === 'CUSTOMER';
                          const isSystem = msg.senderType === 'SYSTEM';

                          if (isSystem) {
                            if (msg.content.includes('[System: Customer Onboarded]')) return null;
                            return (
                              <div key={msg.$id} className="text-center my-3">
                                <span className="text-[13px] text-gray-500 font-medium bg-gray-200 px-4 py-1.5 rounded-full inline-block text-center shadow-sm max-w-[90%] whitespace-pre-wrap">{msg.content}</span>
                              </div>
                            );
                          }

                          return (
                            <div key={msg.$id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                              <div className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed shadow-sm ${isUser ? 'bg-[#000000] text-white rounded-br-sm' : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'}`}>
                                
                                {/* 🚀 ATTACHMENT RENDERER WITH PDF FALLBACK 🚀 */}
                                {msg.attachmentUrl && (
                                  <div className="mb-2">
                                    <img 
                                      src={msg.attachmentUrl} 
                                      alt="Attachment" 
                                      className="max-w-full rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity max-h-[200px] object-cover" 
                                      onClick={() => setLightboxImage(msg.attachmentUrl!)}
                                      onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                      }}
                                    />
                                    <a 
                                      href={msg.attachmentUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="hidden flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors text-gray-800 border border-gray-200"
                                    >
                                      📄 View Document
                                    </a>
                                  </div>
                                )}

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
                   )}

                   {isViewingClosedTicket ? (
                     <div className="p-4 text-center bg-gray-100 border-t border-gray-200 shrink-0 pb-safe">
                       <span className="text-[14px] text-gray-500 font-medium">This conversation is closed.</span>
                     </div>
                   ) : (
                     <div className="p-3 sm:p-4 bg-white border-t border-gray-200 shrink-0 pb-safe z-10">
                       {selectedFile && (
                         <div className="mb-3 relative flex items-center bg-gray-100 rounded-lg p-3 pr-10 text-[13px] font-medium text-gray-700 w-full shadow-sm">
                            <svg className="w-5 h-5 text-gray-500 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                            <span className="truncate flex-1">{selectedFile.name}</span>
                            <button onClick={() => setSelectedFile(null)} className="absolute right-3 bg-red-100 text-red-600 rounded-full p-1.5 hover:bg-red-200 transition-colors">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                         </div>
                       )}
                       <form onSubmit={handleSendMessage} className="flex items-end space-x-2">
                          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf" />
                          
                          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-gray-400 hover:text-[#8B2D75] transition-colors rounded-xl hover:bg-gray-50 shrink-0">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                          </button>
                          
                          <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onFocus={scrollToBottom} placeholder="Message..." className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-[16px] rounded-xl p-3.5 focus:ring-[#000000] focus:border-[#000000] min-w-0" />
                          
                          <button type="submit" disabled={(!inputText.trim() && !selectedFile) || isTyping || isUploading} className="p-3.5 bg-[#000000] text-[#8B2D75] rounded-xl disabled:opacity-50 transition-transform active:scale-95 shrink-0">
                            {isUploading ? <div className="w-6 h-6 border-2 border-[#8B2D75] border-t-transparent rounded-full animate-spin"></div> : <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>}
                          </button>
                       </form>
                     </div>
                   )}
                 </div>
              )}
            </>
          )}
        </div>
      )}

      {!isOpen && (
        <div className="w-full h-full flex items-center justify-center pointer-events-auto">
          <button
            onClick={() => toggleWidget(true)}
            aria-label="Open support chat"
            className="group relative w-[64px] h-[64px] rounded-full aspect-square bg-white border-[3px] border-[#8B2D75] shadow-[0_8px_25px_rgba(0,0,0,0.22)] flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer p-0 select-none outline-none focus:ring-4 focus:ring-[#8B2D75]/20"
          >
            {/* Circular Avatar Container */}
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center p-[2px] bg-white">
              <img 
                src="/support.png" 
                alt="LoraBiz Support" 
                className="w-full h-full object-cover object-top rounded-full select-none pointer-events-none" 
              />
            </div>

            {/* Online status indicator */}
            <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" title="Agent Online"></span>
            
            {/* 🚀 Dynamic Unread Number Badge 🚀 */}
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1.5 bg-gradient-to-r from-red-500 to-rose-600 border-2 border-white rounded-full shadow-lg flex items-center justify-center text-[11px] font-black text-white leading-none animate-bounce z-20">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
