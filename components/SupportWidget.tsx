"use client";

import React, { useState, useEffect, useRef } from 'react';
import { storage } from '@/lib/appwrite-client';
import { ID } from 'appwrite';
import { playCustomerPing, isSoundMuted, setSoundMuted } from '@/lib/sound';

const BUCKET_ID = process.env.NEXT_PUBLIC_APPWRITE_BUCKET_ID || 'attachments';

interface Ticket {
  $id: string;
  title?: string;
  status: string;
  $createdAt: string;
  rating?: number;
  ratingFeedback?: string;
}

interface Message {
  $id: string;
  senderType: 'CUSTOMER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  senderName: string;
  content: string;
  attachmentUrl?: string;
  $createdAt?: string;
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
  
  const [csatRating, setCsatRating] = useState<number>(0);
  const [csatFeedback, setCsatFeedback] = useState<string>('');
  const [csatSubmitted, setCsatSubmitted] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const getInitialTheme = (): 'light' | 'dark' => {
    if (typeof window !== 'undefined') {
      try {
        const params = new URLSearchParams(window.location.search);
        const urlTheme = params.get('theme');
        if (urlTheme === 'dark' || urlTheme === 'light') return urlTheme;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
        if (document.documentElement.classList.contains('dark')) return 'dark';
      } catch (e) {}
    }
    return 'dark'; // default to dark if host is dark
  };

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [soundMuted, setSoundMutedState] = useState(false);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

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
    setSoundMutedState(isSoundMuted());
  }, []);

  const handleToggleSound = () => {
    const nextMuted = !soundMuted;
    setSoundMutedState(nextMuted);
    setSoundMuted(nextMuted);
  };

  useEffect(() => {
    const handleFocus = () => {
      document.title = 'LoraBiz Support';
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlTheme = params.get('theme');
    if (urlTheme === 'dark' || urlTheme === 'light') {
      setTheme(urlTheme);
    }
  }, []);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Set or update <meta name="theme-color"> in widget head
    try {
      let metaThemeColor = document.querySelector("meta[name='theme-color']");
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute('content', theme === 'dark' ? '#080E21' : '#8B2D75');
    } catch (e) {}
  }, [theme]);

  useEffect(() => {
    const handleParentMessage = (event: MessageEvent) => {
      if (event.data === 'LORA_TOGGLE_OPEN') {
        toggleWidget(true);
      } else if (event.data === 'LORA_TOGGLE_CLOSE') {
        toggleWidget(false);
      } else if (event.data && typeof event.data === 'object' && event.data.type === 'LORA_THEME_CHANGE') {
        setTheme(event.data.theme === 'dark' ? 'dark' : 'light');
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
          
          // Smart Unread Counter & Customer Chime
          if (!isOpenRef.current && data.messages.length > 0) {
              if (messagesRef.current.length === 0) {
                  const incoming = data.messages.filter((m: any) => m.senderType !== 'CUSTOMER');
                  if (incoming.length > 0) {
                      setUnreadCount(incoming.length);
                      playCustomerPing();
                  }
              } else if (newReplies.length > 0) {
                  setUnreadCount(count => count + newReplies.length);
                  playCustomerPing();
                  if (typeof document !== 'undefined' && document.hidden) {
                    document.title = '💬 (1) Support reply - LoraBiz';
                  }
              }
          }

          setMessages(prev => {
             const serverIds = new Set(data.messages.map((m: any) => m.$id));
             const inFlight = prev.filter(m => !serverIds.has(m.$id) && !data.messages.some((sm: any) => sm.content === m.content && sm.senderType === m.senderType));
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

      const res = await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticketId: newTicketId, userId: authUserId, message: systemContextMessage, senderName: userDetails.name, customerEmail: userDetails.email 
        }),
      });
      const data = await res.json();
      if (data.reply) {
        const replyMsg = data.message || {
          $id: ID.unique(),
          senderType: data.status === 'HANDOVER_INITIATED' ? 'SYSTEM' : 'ASSISTANT',
          senderName: data.status === 'HANDOVER_INITIATED' ? 'System' : 'Lora',
          content: data.reply
        };
        setMessages(prev => [...prev, replyMsg]);
      }
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
        const upload = await storage.createFile(BUCKET_ID, ID.unique(), selectedFile);
        uploadedFileUrl = storage.getFileView(BUCKET_ID, upload.$id);
      } catch (err) {
        setDialog({ isOpen: true, type: 'alert', title: 'Upload Failed', message: 'There was an error attaching your file. Please try again.' });
      }
      setIsUploading(false); setSelectedFile(null);
    }

    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          ticketId: activeTicketId, messageId, userId: authUserId, message: currentText, senderName: userDetails.name, attachmentUrl: uploadedFileUrl 
        }),
      });
      const data = await res.json();
      if (data.reply) {
        const replyMsg = data.message || {
          $id: ID.unique(),
          senderType: data.status === 'HANDOVER_INITIATED' ? 'SYSTEM' : 'ASSISTANT',
          senderName: data.status === 'HANDOVER_INITIATED' ? 'System' : 'Lora',
          content: data.reply
        };
        setMessages(prev => {
          if (prev.some(m => m.$id === replyMsg.$id || (m.content === replyMsg.content && m.senderType === replyMsg.senderType))) {
            return prev;
          }
          return [...prev, replyMsg];
        });
      }
    } catch (error) {
      setMessages(prev => prev.filter(m => m.$id !== messageId));
    } finally {
      setIsTyping(false);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  const handleExportTranscript = () => {
    const header = `=== LORABIZ SUPPORT CHAT TRANSCRIPT ===\nDate: ${new Date().toLocaleString()}\nTicket ID: ${activeTicketId || 'N/A'}\nCustomer: ${userDetails.name || 'User'} (${userDetails.email || 'N/A'})\n=======================================\n\n`;
    const body = messages.map(m => {
      const sender = m.senderType === 'CUSTOMER' ? 'You' : m.senderType === 'AGENT' ? 'Support Agent' : m.senderType === 'ASSISTANT' ? 'Lora AI' : 'System';
      return `[${sender}]: ${m.content || '[Attachment]'}`;
    }).join('\n\n');

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `lorabiz-chat-transcript.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputText(val);

    if (activeTicketId) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TYPING_STATUS', ticketId: activeTicketId, isTyping: true })
      }).catch(() => {});

      typingTimeoutRef.current = setTimeout(() => {
        fetch('/api/support/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'TYPING_STATUS', ticketId: activeTicketId, isTyping: false })
        }).catch(() => {});
      }, 1500);
    }
  };

  useEffect(() => {
    if (!activeTicketId) {
      setCsatRating(0);
      setCsatFeedback('');
      setCsatSubmitted(false);
      return;
    }
    const currentTicket = historyTickets.find(t => t.$id === activeTicketId);
    const savedLocalRating = typeof window !== 'undefined' ? localStorage.getItem(`lorabiz_csat_rated_${activeTicketId}`) : null;
    
    if (currentTicket?.rating && currentTicket.rating > 0) {
      setCsatRating(currentTicket.rating);
      setCsatFeedback(currentTicket.ratingFeedback || '');
      setCsatSubmitted(true);
    } else if (savedLocalRating) {
      setCsatRating(Number(savedLocalRating));
      setCsatSubmitted(true);
    } else {
      setCsatRating(0);
      setCsatFeedback('');
      setCsatSubmitted(false);
    }
  }, [activeTicketId, historyTickets]);

  const handleSubmitRating = async (ratingVal: number) => {
    setCsatRating(ratingVal);
    setCsatSubmitted(true);
    if (!activeTicketId) return;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(`lorabiz_csat_rated_${activeTicketId}`, String(ratingVal));
      }
      setHistoryTickets(prev => prev.map(t => t.$id === activeTicketId ? { ...t, rating: ratingVal, ratingFeedback: csatFeedback } : t));
      await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SUBMIT_RATING', ticketId: activeTicketId, rating: ratingVal, feedback: csatFeedback })
      });
    } catch (e) {}
  };

  const isDark = theme === 'dark';
  const closedTickets = historyTickets.filter(t => t.status === 'CLOSED').slice(0, 3);
  const activeTicket = historyTickets.find(t => t.$id === activeTicketId);
  const isViewingClosedTicket = activeTicket?.status === 'CLOSED';

  const faqs = [
    {
      q: 'When can I chat with a support agent?',
      a: 'Our human support team is online during regular business hours (8am - 6pm WAT). Lora, our AI assistant, is available 24/7 to resolve inquiries instantly!'
    },
    {
      q: 'How do I check my service request status?',
      a: 'Simply click "Start a new conversation" or resume your active chat, provide your email or reference, and Lora will fetch your real-time status.'
    },
    {
      q: 'How long does CAC registration take?',
      a: 'CAC business name and company registrations typically take between 2 to 5 business days after document submission.'
    }
  ];

  return (
    <div className="w-full h-full flex flex-col justify-end items-end select-none bg-transparent m-0 p-0">
      
      {/* 🚀 IMAGE LIGHTBOX MODAL 🚀 */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in pointer-events-auto" onClick={() => setLightboxImage(null)}>
          <div className="absolute top-6 right-6 flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <a 
              href={lightboxImage} 
              target="_blank" 
              rel="noreferrer" 
              download="lorabiz-attachment" 
              className="text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 backdrop-blur-xs"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
              Download
            </a>
            <button onClick={() => setLightboxImage(null)} className="text-white/90 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition-all backdrop-blur-xs">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <img src={lightboxImage} alt="Enlarged Attachment" className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {isOpen && (
        <div className={`w-full h-full flex flex-col overflow-hidden pointer-events-auto sm:rounded-[20px] transition-all relative overscroll-contain ${
          isDark 
            ? 'bg-[#0B132B] text-slate-100 border border-white/10 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)]' 
            : 'bg-white text-slate-900 border border-slate-200/80 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.18)]'
        }`}>
          
          {/* Custom Dialog Alert/Confirm */}
          {dialog?.isOpen && (
            <div className="absolute inset-0 z-[100] bg-black/60 flex items-center justify-center p-4 backdrop-blur-[3px] animate-in fade-in duration-150">
              <div className={`rounded-2xl shadow-2xl w-full max-w-[320px] p-6 animate-in zoom-in-95 duration-200 border ${
                isDark ? 'bg-[#0E1A38] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}>
                <div className="w-10 h-10 rounded-full bg-[#8B2D75]/15 text-[#8B2D75] flex items-center justify-center mb-3">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-[17px] font-bold mb-1.5 tracking-tight">{dialog.title}</h3>
                <p className={`text-[13.5px] mb-5 leading-relaxed ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{dialog.message}</p>
                <div className="flex justify-end gap-2.5">
                  {dialog.type === 'confirm' && (
                    <button onClick={() => setDialog(null)} className={`px-4 py-2 text-[13px] font-semibold rounded-xl transition-colors ${
                      isDark ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
                    }`}>Cancel</button>
                  )}
                  <button 
                    onClick={() => {
                      if (dialog.type === 'confirm' && dialog.onConfirm) { dialog.onConfirm(); } 
                      else { setDialog(null); }
                    }}
                    className="px-4 py-2 text-[13px] font-semibold text-white bg-gradient-to-r from-[#8B2D75] to-[#731E60] hover:brightness-110 rounded-xl transition-all shadow-xs"
                  >
                    {dialog.type === 'confirm' ? 'Yes, End Chat' : 'Okay'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 Modern Brand Header with Safe Area Insets 🌟 */}
          <div 
            style={{ 
              paddingTop: 'max(env(safe-area-inset-top, 0px), 0.875rem)',
              paddingLeft: 'max(env(safe-area-inset-left, 0px), 1rem)',
              paddingRight: 'max(env(safe-area-inset-right, 0px), 1rem)'
            }}
            className="bg-gradient-to-r from-[#8B2D75] via-[#7B2467] to-[#691C56] pb-3.5 flex justify-between items-center text-white shrink-0 z-10 shadow-sm"
          >
            <div className="flex items-center space-x-3 min-w-0">
              {(view === 'CHAT' || view === 'ONBOARDING') && (
                <button 
                  onClick={() => { setView('HUB'); setActiveTicketId(null); }} 
                  aria-label="Back to Hub"
                  className="hover:bg-white/20 p-1.5 rounded-full transition-colors shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
                </button>
              )}
              
              <div className="relative shrink-0">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center ring-2 ring-white/30 overflow-hidden">
                  <img src="/support.png" alt="LoraBiz" className="w-full h-full object-cover" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#8B2D75] rounded-full"></span>
              </div>

              <div className="min-w-0 flex flex-col">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-[15px] tracking-tight leading-none text-white truncate">LoraBiz Support</h3>
                </div>
                <span className="text-[11px] text-white/80 font-medium leading-tight mt-0.5">
                  {!isViewingClosedTicket && !isInitializing ? '⚡ Online • Instant AI & Agent' : 'Support Desk'}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-1.5 shrink-0">
              {/* Sound Mute Toggle */}
              <button 
                onClick={handleToggleSound} 
                title={soundMuted ? "Unmute notifications" : "Mute notifications"}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/15 rounded-lg transition-colors"
              >
                {soundMuted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                )}
              </button>

              {view === 'CHAT' && !isViewingClosedTicket && !isChatLoading && (
                <button 
                  onClick={handleEndChat} 
                  className="text-[11px] font-bold bg-white/20 hover:bg-red-500 text-white px-2.5 py-1 rounded-md transition-colors shadow-xs"
                >
                  End Chat
                </button>
              )}

              {/* Close Button */}
              <button 
                onClick={() => toggleWidget(false)} 
                aria-label="Close chat widget"
                className="text-white/80 hover:text-white p-1 hover:bg-white/15 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Loading State */}
          {isInitializing ? (
             <div className={`flex-1 flex flex-col items-center justify-center space-y-4 p-6 ${isDark ? 'bg-[#080E21]' : 'bg-slate-50'}`}>
               <div className={`w-16 h-16 rounded-full flex items-center justify-center p-1.5 shadow-sm border animate-pulse ${
                 isDark ? 'bg-[#0E1A38] border-white/10' : 'bg-white border-slate-200'
               }`}>
                  <img src="/support.png" alt="Loading" className="w-full h-full object-contain opacity-80" />
               </div>
               <div className="text-center">
                 <h2 className={`text-[15px] font-bold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Connecting to Support...</h2>
                 <p className="text-xs text-slate-400 mt-0.5">Please hold on a moment</p>
               </div>
               <div className="flex space-x-1.5 mt-2">
                  <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
               </div>
             </div>
          ) : (
            <>
              {/* 🏠 HUB VIEW 🏠 */}
              {view === 'HUB' && (
                <div className={`flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 flex flex-col space-y-4 custom-scrollbar ${isDark ? 'bg-[#080E21]' : 'bg-[#F8FAFC]'}`}>
                  
                  {/* Welcome Greeting Banner */}
                  <div className={`p-4 rounded-2xl border shadow-xs transition-all ${
                    isDark 
                      ? 'bg-gradient-to-br from-[#0E1A38] to-[#122046] border-white/10 text-white' 
                      : 'bg-white border-slate-200/80 text-slate-900'
                  }`}>
                    <div className="flex items-center gap-3.5">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border shadow-xs p-1 ${
                        isDark ? 'bg-[#080E21] border-white/15' : 'bg-slate-50 border-slate-200'
                      }`}>
                        <img src="/support.png" alt="Agent" className="w-full h-full object-cover rounded-full" />
                      </div>
                      <div>
                        <h2 className="text-[17px] font-extrabold tracking-tight">
                          Hi {userDetails.name ? userDetails.name.split(' ')[0] : 'there'} 👋
                        </h2>
                        <p className={`text-[13px] leading-snug mt-0.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          How can we help make your business journey easier today?
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <div className="space-y-2.5">
                    {openTicket ? (
                      <button 
                        onClick={() => handleStartChat()} 
                        className="w-full group flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 hover:brightness-110 text-white p-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse"></span>
                          <div className="text-left">
                            <span className="font-bold text-[14.5px] block leading-tight">Resume Active Chat</span>
                            <span className="text-[11px] text-white/80">Continue where you left off</span>
                          </div>
                        </div>
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleStartChat()} 
                        className="w-full group flex items-center justify-between bg-gradient-to-r from-[#8B2D75] via-[#9F2B85] to-[#6E1A5B] hover:brightness-110 text-white p-3.5 px-4 rounded-xl shadow-md transition-all active:scale-[0.99] cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <svg className="w-5 h-5 text-white/90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                          <div className="text-left">
                            <span className="font-bold text-[14.5px] block leading-tight">Start a new conversation</span>
                            <span className="text-[11px] text-white/80">⚡ Usually replies in ~2 minutes</span>
                          </div>
                        </div>
                        <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                      </button>
                    )}
                    
                    {/* Quick Channels Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <a 
                        href="https://wa.me/2348000000000" 
                        target="_blank" 
                        rel="noreferrer" 
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all hover:scale-[1.01] ${
                          isDark 
                            ? 'bg-[#0E1A38] border-white/10 hover:border-emerald-500/40 text-slate-200' 
                            : 'bg-white border-slate-200/80 hover:border-emerald-500/40 text-slate-800'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#25D366]/15 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12.031 0c-6.627 0-12.002 5.373-12.002 11.996 0 2.115.549 4.184 1.593 6.002l-1.622 5.952 6.096-1.597c1.764.957 3.754 1.464 5.935 1.464 6.627 0 12.001-5.372 12.001-11.996 0-6.623-5.374-11.996-12.001-11.996zm6.386 17.202c-.267.755-1.545 1.458-2.128 1.528-.544.066-1.25.138-3.593-.83-2.827-1.171-4.636-4.048-4.773-4.225-.138-.178-1.139-1.517-1.139-2.894 0-1.378.716-2.053.966-2.319.251-.267.545-.334.726-.334.18 0 .361 0 .513.009.157.009.378-.059.589.445.213.504.726 1.766.793 1.899.066.134.11.293.02.471-.09.178-.138.289-.276.446-.138.156-.29.356-.414.489-.138.156-.289.324-.124.624.164.298.726 1.218 1.554 2.046 1.066 1.064 1.975 1.385 2.274 1.519.298.134.471.111.647-.067.178-.178.761-.885.966-1.189.205-.304.41-.253.682-.156.273.098 1.722.815 2.019.964.298.148.497.223.57.347.074.124.074.726-.193 1.48z"/>
                          </svg>
                        </div>
                        <div className="text-left min-w-0">
                          <span className="font-bold text-[13px] block leading-tight">WhatsApp</span>
                          <span className="text-[10.5px] text-slate-400 block truncate">Direct Support</span>
                        </div>
                      </a>

                      <a 
                        href="mailto:help@support.lorabiz.com" 
                        target="_top" 
                        className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all hover:scale-[1.01] ${
                          isDark 
                            ? 'bg-[#0E1A38] border-white/10 hover:border-blue-500/40 text-slate-200' 
                            : 'bg-white border-slate-200/80 hover:border-blue-500/40 text-slate-800'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                        </div>
                        <div className="text-left min-w-0">
                          <span className="font-bold text-[13px] block leading-tight">Email Us</span>
                          <span className="text-[10.5px] text-slate-400 block truncate">help@lorabiz</span>
                        </div>
                      </a>
                    </div>
                  </div>

                  {/* Previous Conversations */}
                  {closedTickets.length > 0 && (
                    <div className={`pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
                      <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Previous Conversations</h4>
                      <div className="space-y-2">
                        {closedTickets.map(ticket => (
                          <button 
                            key={ticket.$id} 
                            onClick={() => handleOpenHistory(ticket.$id)} 
                            className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between ${
                              isDark 
                                ? 'bg-[#0E1A38] border-white/10 hover:border-white/20 text-slate-200' 
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <span className="font-semibold text-[13px] block truncate">{ticket.title || 'General Support Ticket'}</span>
                              <span className="text-[11px] text-slate-400">Resolved • {new Date(ticket.$createdAt).toLocaleDateString()}</span>
                            </div>
                            <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive Quick FAQ Section */}
                  <div className={`pt-2 border-t ${isDark ? 'border-white/10' : 'border-slate-200/80'}`}>
                    <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Frequently Asked Questions</h4>
                    <div className="space-y-2">
                      {faqs.map((faq, idx) => {
                        const isExpanded = expandedFaq === idx;
                        return (
                          <div 
                            key={idx} 
                            className={`rounded-xl border transition-all overflow-hidden ${
                              isDark ? 'bg-[#0E1A38] border-white/10' : 'bg-white border-slate-200/80'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                              className="w-full p-3 text-left flex justify-between items-center gap-2"
                            >
                              <span className={`text-[13px] font-semibold ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{faq.q}</span>
                              <svg 
                                className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-[#8B2D75]' : ''}`} 
                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {isExpanded && (
                              <div className={`px-3 pb-3 text-[12.5px] leading-relaxed border-t pt-2 ${
                                isDark ? 'text-slate-300 border-white/5' : 'text-slate-600 border-slate-100'
                              }`}>
                                {faq.a}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Footer Tag */}
                  <div className="text-center py-1">
                    <span className="text-[10.5px] font-medium text-slate-400">⚡ Secured by LoraBiz Support Desk</span>
                  </div>
                </div>
              )}

              {/* 📋 ONBOARDING VIEW 📋 */}
              {view === 'ONBOARDING' && (
                <div className={`flex-1 overflow-y-auto overscroll-contain p-5 flex flex-col justify-start custom-scrollbar ${isDark ? 'bg-[#080E21] text-white' : 'bg-[#F8FAFC] text-slate-900'}`}>
                  <div className="text-center mb-5 mt-1">
                    <div className="w-12 h-12 rounded-full bg-[#8B2D75]/15 text-[#8B2D75] flex items-center justify-center mx-auto mb-2.5">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                    </div>
                    <h2 className="text-[19px] font-extrabold tracking-tight">How can we help?</h2>
                    <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Fill in quick details to connect with the best support team.</p>
                  </div>

                  <form onSubmit={handleOnboardingSubmit} className="space-y-3.5">
                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Full Name</label>
                      <input 
                        required 
                        type="text" 
                        value={userDetails.name} 
                        onChange={(e) => setUserDetails({...userDetails, name: e.target.value})} 
                        readOnly={!!authUserId} 
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-[14px] focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent outline-none transition-all ${
                          isDark ? 'bg-[#0E1A38] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                        } ${authUserId ? 'opacity-70 cursor-not-allowed' : ''}`} 
                        placeholder="e.g. Mukhtar Akanni" 
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Email Address</label>
                      <input 
                        required 
                        type="email" 
                        value={userDetails.email} 
                        onChange={(e) => setUserDetails({...userDetails, email: e.target.value})} 
                        readOnly={!!authUserId} 
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-[14px] focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent outline-none transition-all ${
                          isDark ? 'bg-[#0E1A38] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                        } ${authUserId ? 'opacity-70 cursor-not-allowed' : ''}`} 
                        placeholder="e.g. mukhtar@example.com" 
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Topic / Service Category</label>
                      <select 
                        required 
                        value={userDetails.topic} 
                        onChange={(e) => setUserDetails({...userDetails, topic: e.target.value})} 
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-[14px] focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent outline-none transition-all ${
                          isDark ? 'bg-[#0E1A38] border-white/10 text-white' : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        <option value="" disabled>Choose a service...</option>
                        <option value="CAC Biz/LLC Registration">CAC Biz/LLC Registration</option>
                        <option value="NIN Slip Generation">NIN Slip Generation</option>
                        <option value="Airtime & Data Bundle">Airtime & Data Bundle</option>
                        <option value="Tax ID Generation">Tax ID Generation</option>
                        <option value="Account & Login Assistance">Account & Login Assistance</option>
                        <option value="Payment / Billing Issue">Payment / Billing Issue</option>
                        <option value="General Support">General Support</option>
                      </select>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Describe your issue (optional)</label>
                      <textarea 
                        rows={2} 
                        value={userDetails.description} 
                        onChange={(e) => setUserDetails({...userDetails, description: e.target.value})} 
                        className={`w-full border rounded-xl px-3.5 py-2.5 text-[14px] focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent outline-none resize-none transition-all ${
                          isDark ? 'bg-[#0E1A38] border-white/10 text-white placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                        }`} 
                        placeholder="Tell us what you need help with..."
                      />
                    </div>

                    <button 
                      type="submit" 
                      className="w-full bg-gradient-to-r from-[#8B2D75] to-[#731E60] hover:brightness-110 text-white font-bold py-3.5 rounded-xl shadow-md transition-all active:scale-[0.99] mt-2 cursor-pointer text-[14.5px]"
                    >
                      Start Conversation →
                    </button>
                  </form>
                </div>
              )}

              {/* 💬 CHAT VIEW 💬 */}
              {view === 'CHAT' && (
                 <div className={`flex-1 flex flex-col min-h-0 ${isDark ? 'bg-[#080E21]' : 'bg-[#F8FAFC]'}`}>
                   
                   {isChatLoading ? (
                     <div className="flex-1 p-5 flex flex-col space-y-4 justify-end">
                       <div className="flex justify-start animate-pulse"><div className={`w-2/3 h-12 rounded-2xl rounded-bl-xs ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}></div></div>
                       <div className="flex justify-end animate-pulse mt-3"><div className="bg-[#8B2D75]/30 w-1/2 h-10 rounded-2xl rounded-br-xs"></div></div>
                       <div className="flex justify-start animate-pulse mt-3"><div className={`w-3/4 h-16 rounded-2xl rounded-bl-xs ${isDark ? 'bg-white/5' : 'bg-slate-200'}`}></div></div>
                     </div>
                   ) : (
                     <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 relative custom-scrollbar flex flex-col">
                        <div className="mt-auto space-y-3.5 flex flex-col justify-end">
                          {messages.map((msg) => {
                            const isUser = msg.senderType === 'CUSTOMER';
                            const isSystem = msg.senderType === 'SYSTEM';

                            if (isSystem) {
                              if (msg.content.includes('[System: Customer Onboarded]')) return null;
                              return (
                                <div key={msg.$id} className="text-center my-2">
                                  <span className={`text-[11.5px] font-medium px-3.5 py-1 rounded-full inline-block text-center shadow-2xs max-w-[90%] whitespace-pre-wrap ${
                                    isDark ? 'bg-[#0E1A38] text-slate-300 border border-white/10' : 'bg-slate-200/80 text-slate-600'
                                  }`}>{msg.content}</span>
                                </div>
                              );
                            }

                            return (
                              <div key={msg.$id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} group/bubble relative`}>
                                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-2xs relative group ${
                                  isUser 
                                    ? 'bg-gradient-to-br from-[#8B2D75] to-[#751E5E] text-white rounded-tr-xs' 
                                    : isDark 
                                      ? 'bg-[#122046] text-slate-100 border border-white/10 rounded-tl-xs' 
                                      : 'bg-white text-slate-900 border border-slate-200/80 rounded-tl-xs'
                                }`}>
                                  
                                  {/* Sender Title when assistant/agent */}
                                  {!isUser && (
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <span className="text-[11px] font-bold text-[#8B2D75] dark:text-[#E063B8]">
                                        {msg.senderName || (msg.senderType === 'AGENT' ? 'Support Agent' : 'Lora AI')}
                                      </span>
                                    </div>
                                  )}

                                  {/* Attachment Renderer with PDF fallback */}
                                  {msg.attachmentUrl && (
                                    <div className="mb-2">
                                      <img 
                                        src={msg.attachmentUrl} 
                                        alt="Attachment" 
                                        className="max-w-full rounded-lg border border-slate-200 cursor-pointer hover:opacity-85 transition-opacity max-h-[190px] object-cover" 
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
                                        className={`hidden flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-colors border ${
                                          isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-800 hover:bg-slate-200'
                                        }`}
                                      >
                                        📄 View Attached Document
                                      </a>
                                    </div>
                                  )}

                                  {msg.content && <span className="whitespace-pre-wrap">{msg.content}</span>}

                                  {/* 1-Click Copy on message */}
                                  {msg.content && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyText(msg.$id, msg.content)}
                                      title="Copy message"
                                      className={`opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-2 right-2 rounded-md px-1.5 py-0.5 shadow-2xs text-[10px] font-medium border ${
                                        isDark ? 'bg-[#0E1A38] border-white/15 text-slate-300 hover:text-white' : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      {copiedMessageId === msg.$id ? '✓ Copied' : '📋 Copy'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          
                          {/* Typing indicator */}
                          {isTyping && (
                            <div className="flex justify-start">
                              <div className={`border rounded-2xl rounded-tl-xs px-3.5 py-2 flex space-x-1.5 items-center ${
                                isDark ? 'bg-[#122046] border-white/10' : 'bg-white border-slate-200'
                              }`}>
                                <div className="w-1.5 h-1.5 bg-[#8B2D75] rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                              </div>
                            </div>
                          )}
                          <div ref={messagesEndRef} />
                        </div>
                     </div>
                   )}

                    {/* CSAT / Closed View or Chat Composer */}
                    {isViewingClosedTicket ? (
                      <div className={`p-4 border-t shrink-0 pb-safe space-y-3 ${
                        isDark ? 'bg-[#0E1A38] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                      }`}>
                        {(csatSubmitted || (activeTicket?.rating && activeTicket.rating > 0)) ? (
                          <div className="text-center py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 space-y-0.5">
                            <div className="text-emerald-500 font-bold text-xs flex items-center justify-center gap-1.5">
                              <span>✓ You rated this support session {csatRating || activeTicket?.rating} ★</span>
                            </div>
                            <p className={`text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Thank you for helping us improve!</p>
                          </div>
                        ) : (
                          <>
                            <div className="text-center">
                              <h4 className="text-[13.5px] font-bold">How was your support experience?</h4>
                              <p className={`text-[11.5px] mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Tap a star to share feedback</p>
                            </div>

                            <div className="flex flex-col items-center gap-2.5">
                              <div className="flex gap-2">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <button
                                    key={star}
                                    type="button"
                                    onClick={() => handleSubmitRating(star)}
                                    className={`text-2xl transition-transform hover:scale-125 cursor-pointer ${csatRating >= star ? 'text-amber-400' : 'text-slate-300 dark:text-slate-600 hover:text-amber-300'}`}
                                  >
                                    ★
                                  </button>
                                ))}
                              </div>
                              <div className="flex w-full gap-2">
                                <input
                                  type="text"
                                  placeholder="Add an optional comment..."
                                  value={csatFeedback}
                                  onChange={(e) => setCsatFeedback(e.target.value)}
                                  className={`flex-1 text-xs border rounded-xl px-3 py-2 outline-none focus:ring-1 focus:ring-[#8B2D75] ${
                                    isDark ? 'bg-[#080E21] border-white/10 text-white placeholder:text-slate-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                                  }`}
                                />
                                {csatRating > 0 && (
                                  <button
                                    onClick={() => handleSubmitRating(csatRating)}
                                    className="px-3 py-2 bg-[#8B2D75] text-white text-xs font-bold rounded-xl hover:bg-[#731E60] cursor-pointer"
                                  >
                                    Submit
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}

                        <div className={`pt-2 border-t flex justify-between items-center text-[11.5px] ${isDark ? 'border-white/10' : 'border-slate-100'}`}>
                          <button onClick={handleExportTranscript} className="text-[#8B2D75] dark:text-[#E063B8] hover:underline font-semibold flex items-center gap-1 cursor-pointer">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Save Transcript
                          </button>
                          <button onClick={() => setView('HUB')} className={`font-semibold cursor-pointer ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                            Back to Hub →
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div 
                        style={{
                          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 0.75rem)',
                          paddingLeft: 'max(env(safe-area-inset-left, 0px), 0.75rem)',
                          paddingRight: 'max(env(safe-area-inset-right, 0px), 0.75rem)',
                        }}
                        className={`pt-3 border-t shrink-0 z-10 ${
                          isDark ? 'bg-[#0E1A38] border-white/10' : 'bg-white border-slate-200'
                        }`}
                      >
                        {selectedFile && (
                          <div className={`mb-2.5 relative flex items-center rounded-xl p-2.5 pr-8 text-[12px] font-medium w-full shadow-2xs border ${
                            isDark ? 'bg-[#080E21] border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}>
                             <svg className="w-4 h-4 text-slate-400 mr-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                             <span className="truncate flex-1">{selectedFile.name}</span>
                             <button onClick={() => setSelectedFile(null)} className="absolute right-2.5 text-slate-400 hover:text-red-400 p-1">
                               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                             </button>
                          </div>
                        )}
                        
                        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                           <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf" />
                           
                           <button 
                             type="button" 
                             onClick={() => fileInputRef.current?.click()} 
                             title="Attach file"
                             className={`p-2.5 transition-colors rounded-xl shrink-0 cursor-pointer ${
                               isDark ? 'text-slate-400 hover:text-[#E063B8] hover:bg-white/5' : 'text-slate-500 hover:text-[#8B2D75] hover:bg-slate-100'
                             }`}
                           >
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                           </button>
                           
                           <input 
                             type="text" 
                             value={inputText} 
                             onChange={handleInputChange} 
                             onFocus={scrollToBottom} 
                             placeholder="Type a message..." 
                             className={`flex-1 text-[14.5px] rounded-xl px-3.5 py-2.5 min-w-0 outline-none border transition-all ${
                               isDark 
                                 ? 'bg-[#080E21] border-white/10 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent' 
                                 : 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#8B2D75] focus:border-transparent'
                             }`} 
                           />
                           
                           <button 
                             type="submit" 
                             disabled={(!inputText.trim() && !selectedFile) || isTyping || isUploading} 
                             aria-label="Send message"
                             className="p-2.5 bg-gradient-to-r from-[#8B2D75] to-[#731E60] hover:brightness-110 text-white rounded-xl disabled:opacity-40 transition-all active:scale-95 shrink-0 shadow-xs cursor-pointer"
                           >
                             {isUploading ? (
                               <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                             ) : (
                               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                             )}
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

      {/* 🔘 CIRCULAR LAUNCHER BUTTON (CLOSED STATE) 🔘 */}
      {!isOpen && (
        <div className="w-full h-full flex items-center justify-center bg-transparent pointer-events-auto select-none p-0 m-0 border-0 outline-none overflow-hidden rounded-full">
          <button
            onClick={() => toggleWidget(true)}
            aria-label="Open support chat"
            className="group relative w-full h-full rounded-full border-0 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer p-0 select-none outline-none overflow-hidden bg-gradient-to-tr from-[#8B2D75] via-[#9F2B85] to-[#6E1A5B] shadow-[0_4px_16px_rgba(139,45,117,0.45)] ring-2 ring-white/20"
          >
            {/* Inner avatar container with seamless rounded crop */}
            <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center p-0 bg-transparent">
              <img 
                src="/support.png" 
                alt="LoraBiz Support" 
                className="w-full h-full object-cover rounded-full select-none pointer-events-none" 
              />
            </div>

            {/* Online pulsing green indicator */}
            <span className="absolute bottom-1 right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full shadow-xs ring-1 ring-emerald-500/20" title="Agent Online"></span>
            
            {/* Dynamic Unread Number Badge - perched clearly at top-right neck */}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[19px] h-[19px] px-1 bg-gradient-to-r from-red-500 via-rose-500 to-red-600 border-2 border-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] rounded-full flex items-center justify-center text-[10px] font-black text-white leading-none animate-bounce z-20">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
