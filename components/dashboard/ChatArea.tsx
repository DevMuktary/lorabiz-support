import React, { useState, useRef, useEffect } from 'react';
import { Ticket, Message } from '@/types/dashboard';
import TicketContext from './TicketContext';
import { ChevronLeft, Send, Lock, Info, ArrowDown, User, XCircle, RefreshCw, Paperclip, X, Zap, Sparkles, Download, Copy, Check, Bot, ShieldAlert } from 'lucide-react';

const CANNED_RESPONSES = [
  { label: 'Greeting', text: 'Hello! Thank you for reaching out to LoraBiz Support. How can I assist you today?' },
  { label: 'Please Hold', text: 'I am looking into this for you right now. Please give me just a moment.' },
  { label: 'Email Sent', text: 'We have sent full details directly to your registered email address. Please check your inbox.' },
  { label: 'Working Hours', text: 'Our live support team is active Monday to Friday, 9:00 AM – 5:00 PM.' },
  { label: 'Resolved', text: 'Thank you for contacting LoraBiz Support! Please let us know if you need any further assistance.' },
];

interface ChatAreaProps {
  ticket: Ticket;
  messages: Message[];
  isFetchingChat: boolean;
  isCustomerTyping: boolean;
  loading: boolean;
  onBack: () => void;
  onPickTicket: () => void;
  onEndChat: () => void;
  onReopenTicket: () => void;
  onSendMessage: (content: string, isInternalNote: boolean, file: File | null) => void;
}

export default function ChatArea({
  ticket, messages, isFetchingChat, isCustomerTyping, loading,
  onBack, onPickTicket, onEndChat, onReopenTicket, onSendMessage
}: ChatAreaProps) {
  const [replyContent, setReplyContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showMobileContext, setShowMobileContext] = useState(false); 
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [isGeneratingAiSuggest, setIsGeneratingAiSuggest] = useState(false);
  const [isAiDisabled, setIsAiDisabled] = useState(!!ticket.aiDisabled);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [dialog, setDialog] = useState<{ isOpen: boolean, title: string, message: string, action: () => void } | null>(null);

  useEffect(() => {
    setIsAiDisabled(!!ticket.aiDisabled);
  }, [ticket.aiDisabled, ticket.$id]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const cleanMessages = messages.filter(msg => {
    const text = msg.content || '';
    if (text.includes('[INTERNAL NOTE]')) return true; 
    if (msg.senderType?.toUpperCase() === 'SYSTEM') return false; 
    if (text.includes('[System:')) return false; 
    if (text.includes('SYSTEM DIRECTIVE:')) return false; 
    return true;
  });

  const handleCopyText = (id: string, text: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMessageId(id);
      setTimeout(() => setCopiedMessageId(null), 2000);
    }
  };

  const handleToggleAi = async (disableAi: boolean) => {
    try {
      setIsAiDisabled(disableAi);
      ticket.aiDisabled = disableAi;
      await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_AI_MODE', ticketId: ticket.$id, aiDisabled: disableAi })
      });
      setDialog(null);
    } catch (e) {}
  };

  const handleIntervene = async () => {
    try {
      setIsAiDisabled(true);
      ticket.aiDisabled = true;
      await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADMIN_INTERVENE', ticketId: ticket.$id, agentName: 'Admin' })
      });
      onPickTicket();
      setDialog(null);
    } catch (e) {}
  };

  const handleForceEndChat = async () => {
    try {
      await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FORCE_END_CHAT', ticketId: ticket.$id, reason: 'Terminated by Admin.' })
      });
      onEndChat();
      setDialog(null);
    } catch (e) {}
  };

  const handleExportTranscript = () => {
    const header = `=== LORABIZ SUPPORT CHAT TRANSCRIPT ===\nTicket ID: ${ticket.$id}\nCustomer: ${ticket.customerEmail || ticket.customerPhone || 'Guest'}\nChannel: ${ticket.sourceChannel}\nDate: ${new Date(ticket.$createdAt).toLocaleString()}\n=======================================\n\n`;
    const body = messages.map(m => {
      const time = new Date(m.$createdAt).toLocaleTimeString();
      const sender = m.senderType === 'CUSTOMER' ? 'Customer' : m.senderType === 'AGENT' ? `Agent (${m.senderName})` : m.senderType === 'ASSISTANT' ? 'Lora AI' : 'System';
      return `[${time}] ${sender}: ${m.content || '[Attachment]'}`;
    }).join('\n\n');

    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-${ticket.$id.slice(-6)}-transcript.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleAiSuggest = async () => {
    setIsGeneratingAiSuggest(true);
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'AI_SUGGEST', ticketId: ticket.$id })
      });
      const data = await res.json();
      if (data.suggestion) {
        setReplyContent(data.suggestion);
      }
    } catch (e) {
    } finally {
      setIsGeneratingAiSuggest(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }
    if (e.altKey && (e.key === 'n' || e.key === 'N')) {
      e.preventDefault();
      setIsInternalNote(prev => !prev);
    }
  };

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isUp = scrollHeight - scrollTop - clientHeight > 100;
    setIsScrolledUp(isUp);
  };

  useEffect(() => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [cleanMessages.length, isCustomerTyping, isFetchingChat]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (e.target.files[0].size > 5 * 1024 * 1024) { 
        setDialog({ isOpen: true, title: 'File Too Large', message: 'Attachment must be less than 5MB.', action: () => setDialog(null) });
        return; 
      }
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() && !selectedFile) return;
    
    onSendMessage(replyContent, isInternalNote, selectedFile);
    
    setReplyContent('');
    setSelectedFile(null);
    setIsScrolledUp(false); 
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const realCustomerName = cleanMessages.slice().reverse().find(m => m.senderType === 'CUSTOMER')?.senderName;
  const displayIdentifier = ticket.customerPhone || ticket.customerEmail || `Ticket #${ticket.$id.slice(-6)}`;

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0a1126] relative">
      
      {/* 🚀 IMAGE LIGHTBOX MODAL 🚀 */}
      {lightboxImage && (
        <div className="absolute inset-0 z-[999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in" onClick={() => setLightboxImage(null)}>
          <button className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 p-2 rounded-full transition-colors">
            <X className="w-6 h-6" />
          </button>
          <img src={lightboxImage} alt="Enlarged Attachment" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* CONFIRMATION DIALOG */}
      {dialog && dialog.isOpen && (
        <div className="absolute inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0d152b] border border-white/10 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-extrabold text-lg mb-2">{dialog.title}</h3>
            <p className="text-gray-400 text-sm mb-6 leading-relaxed">{dialog.message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDialog(null)} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors">Cancel</button>
              <button onClick={dialog.action} className="px-5 py-2 rounded-lg text-sm font-bold bg-[#c82d75] hover:bg-[#a62460] text-white transition-colors">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* CENTER PANE */}
      <div className={`flex-1 flex flex-col min-w-0 transition-transform ${showMobileContext ? '-translate-x-full lg:translate-x-0' : ''} relative`}>
        
        <header className="px-4 py-3 md:px-6 md:py-4 border-b border-white/5 bg-[#0d152b] flex items-center justify-between z-10 shrink-0 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-300 transition-colors shrink-0">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="min-w-0">
              <h2 className="font-bold text-white flex items-center gap-2 text-base md:text-lg truncate">
                {realCustomerName || displayIdentifier}
              </h2>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest mt-0.5">
                <span className="text-[#c82d75]">via {ticket.sourceChannel}</span>
                {realCustomerName && <span className="text-gray-500 lowercase normal-case tracking-normal truncate">({displayIdentifier})</span>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            {/* 🛑 AI TOKEN SAVER TOGGLE */}
            {ticket.status !== 'CLOSED' && (
              isAiDisabled ? (
                <button
                  type="button"
                  onClick={() => setDialog({
                    isOpen: true,
                    title: 'Resume AI Auto-Reply',
                    message: 'Re-enable Lora AI to automatically answer incoming messages for this customer?',
                    action: () => handleToggleAi(false)
                  })}
                  title="AI is paused (Tokens protected). Click to re-enable."
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">AI Paused</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setDialog({
                    isOpen: true,
                    title: 'Pause AI (Save Tokens)',
                    message: 'Pause Lora AI auto-replies for this ticket? Customer messages will wait for a human agent without spending AI tokens.',
                    action: () => handleToggleAi(true)
                  })}
                  title="AI is auto-responding. Click to pause and save tokens."
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Bot className="w-3.5 h-3.5 animate-pulse" />
                  <span className="hidden sm:inline">AI Active</span>
                </button>
              )
            )}

            {/* ⚡ DABBLE IN / TAKE OVER */}
            {(ticket.status === 'OPEN' || ticket.status === 'PENDING_AGENT') && (
              <button
                type="button"
                onClick={() => setDialog({
                  isOpen: true,
                  title: 'Dabble In & Take Over',
                  message: 'Step into this conversation? This will assign you as the active agent and pause AI auto-replies to save tokens.',
                  action: () => handleIntervene()
                })}
                disabled={loading}
                className="px-3 py-1.5 bg-[#c82d75] hover:bg-[#a62460] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>Take Over</span>
              </button>
            )}

            {/* 🚫 FORCE END CHAT */}
            {ticket.status !== 'CLOSED' && (
              <button
                type="button"
                onClick={() => setDialog({
                  isOpen: true,
                  title: 'Force End Conversation',
                  message: 'Forcibly terminate this chat session? This will immediately close the ticket and prevent further token consumption.',
                  action: () => handleForceEndChat()
                })}
                disabled={loading}
                className="p-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                title="Force End Chat"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}

            {ticket.status === 'CLOSED' && (
              <button onClick={() => setDialog({ isOpen: true, title: 'Reopen Ticket', message: 'Are you sure you want to reopen this ticket? You will be assigned as the active agent.', action: () => { onReopenTicket(); setDialog(null); }})} disabled={loading} className="px-3.5 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/> Reopen</button>
            )}

            <button onClick={() => setShowMobileContext(!showMobileContext)} className="xl:hidden p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
              <Info className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* 🛑 TOKEN SAVER BANNER */}
        {isAiDisabled && ticket.status !== 'CLOSED' && (
          <div className="mx-4 mt-3 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs text-amber-200 shrink-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span><strong>AI Token Saver Active:</strong> Lora AI is paused. Incoming messages will not consume AI tokens.</span>
            </div>
            <button onClick={() => handleToggleAi(false)} className="text-amber-400 hover:underline font-bold text-[11px] shrink-0 ml-2 cursor-pointer">Resume AI →</button>
          </div>
        )}

        {/* FEED AREA */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative flex flex-col">
          {isFetchingChat ? (
            <div className="animate-pulse space-y-6 flex flex-col justify-end h-full">
              <div className="flex justify-start"><div className="bg-white/5 w-2/3 h-16 rounded-2xl"></div></div>
              <div className="flex justify-end"><div className="bg-[#c82d75]/30 w-1/2 h-20 rounded-2xl"></div></div>
              <div className="flex justify-start"><div className="bg-white/5 w-3/4 h-12 rounded-2xl"></div></div>
            </div>
          ) : (
            <div className="mt-auto space-y-6 flex flex-col justify-end">
              {cleanMessages.map((msg) => {
                const isInternal = msg.content.startsWith('[INTERNAL NOTE]');
                const displayContent = isInternal ? msg.content.replace('[INTERNAL NOTE]:', '').trim() : msg.content;
                
                return (
                  <div key={msg.$id} className={`flex flex-col group/msg ${msg.senderType === 'AGENT' || isInternal ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[70%] p-4 text-[15px] flex flex-col relative group ${
                        isInternal
                          ? 'bg-amber-900/40 text-amber-100 border border-amber-500/30 rounded-2xl rounded-tr-sm' 
                        : msg.senderType === 'AGENT'
                          ? 'bg-[#c82d75] text-white rounded-2xl rounded-tr-sm shadow-md'
                        : msg.senderType === 'ASSISTANT'
                          ? 'bg-[#1e1b4b] text-indigo-100 border border-indigo-500/30 rounded-2xl rounded-tl-sm'
                        : 'bg-[#131b33] text-gray-200 border border-white/5 rounded-2xl rounded-tl-sm'
                      }`}
                    >
                      {isInternal && (
                        <div className="flex items-center gap-1.5 mb-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-wider">
                          <Lock className="w-3 h-3" /> Internal Note
                        </div>
                      )}
                      
                      {/* 🚀 ATTACHMENT RENDERER WITH PDF FALLBACK 🚀 */}
                      {msg.attachmentUrl && (
                        <div className="mb-2">
                          <img 
                            src={msg.attachmentUrl} 
                            alt="Attachment" 
                            className="max-w-full rounded-lg border border-white/10 cursor-pointer hover:opacity-80 transition-opacity max-h-[250px] object-cover" 
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
                            className="hidden flex items-center justify-center gap-2 p-3 bg-white/5 rounded-lg text-sm font-medium hover:bg-white/10 transition-colors text-white border border-white/10"
                          >
                            📄 View Document
                          </a>
                        </div>
                      )}

                      {msg.content && <span className="leading-relaxed break-words whitespace-pre-wrap">{displayContent}</span>}
                      
                      {/* Copy message button */}
                      {msg.content && (
                        <button
                          type="button"
                          onClick={() => handleCopyText(msg.$id, displayContent)}
                          title="Copy text"
                          className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-3 right-2 bg-[#0d152b] border border-white/10 p-1.5 rounded-lg text-gray-400 hover:text-white shadow-lg text-xs flex items-center gap-1"
                        >
                          {copiedMessageId === msg.$id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}

                      <span className={`block text-[10px] font-bold mt-2 uppercase tracking-wider opacity-60 ${msg.senderType === 'AGENT' || isInternal ? 'text-right' : 'text-left'}`}>
                        {msg.senderName} • {new Date(msg.$createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}

              {isCustomerTyping && (
                <div className="flex justify-start">
                  <div className="bg-[#131b33] border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 flex space-x-1.5 items-center">
                    <div className="w-2 h-2 bg-[#c82d75] rounded-full animate-bounce"></div><div className="w-2 h-2 bg-[#c82d75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div><div className="w-2 h-2 bg-[#c82d75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {isScrolledUp && !isFetchingChat && (
          <button onClick={() => { setIsScrolledUp(false); messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }} className="absolute bottom-24 right-6 bg-[#c82d75] text-white p-3 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:scale-105 transition-all z-20 flex items-center animate-bounce border border-white/10">
            <ArrowDown className="w-5 h-5" />
          </button>
        )}

        {/* Input Area */}
        <div className="p-3 md:p-5 bg-[#0d152b] border-t border-white/5 shrink-0 pb-safe z-10">
          {ticket.status === 'IN_PROGRESS' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-4xl mx-auto">
              
              {/* Note Toggle, AI Copilot, Quick Replies */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 relative flex-wrap">
                  <button type="button" onClick={() => { setIsInternalNote(false); setShowQuickReplies(false); }} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${!isInternalNote ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>Reply Customer</button>
                  <button type="button" onClick={() => { setIsInternalNote(true); setShowQuickReplies(false); }} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${isInternalNote ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'text-gray-500 hover:bg-white/5'}`}><Lock className="w-3 h-3" /> Internal Note</button>
                  
                  {/* ✨ AI Copilot Suggest Button */}
                  {!isInternalNote && (
                    <button
                      type="button"
                      onClick={handleAiSuggest}
                      disabled={isGeneratingAiSuggest}
                      title="AI drafts a recommended reply based on conversation history"
                      className="text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isGeneratingAiSuggest ? (
                        <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3 text-indigo-400" />
                      )}
                      <span>{isGeneratingAiSuggest ? 'Drafting...' : 'AI Suggest'}</span>
                    </button>
                  )}

                  {/* Quick Replies / Macros */}
                  {!isInternalNote && (
                    <div className="relative">
                      <button 
                        type="button" 
                        onClick={() => setShowQuickReplies(!showQuickReplies)} 
                        className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${showQuickReplies ? 'bg-[#c82d75] text-white' : 'bg-white/5 text-[#c82d75] hover:bg-[#c82d75]/10 border border-[#c82d75]/20'}`}
                      >
                        <Zap className="w-3 h-3" /> Quick Replies
                      </button>

                      {showQuickReplies && (
                        <div className="absolute bottom-full left-0 mb-2 w-80 bg-[#0d152b] border border-white/10 rounded-xl shadow-2xl p-2 z-30 space-y-1 animate-in fade-in zoom-in-95">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1">Saved Responses</div>
                          {CANNED_RESPONSES.map((item) => (
                            <button
                              key={item.label}
                              type="button"
                              onClick={() => {
                                setReplyContent(item.text);
                                setShowQuickReplies(false);
                              }}
                              className="w-full text-left p-2 rounded-lg hover:bg-white/10 transition-colors flex flex-col gap-0.5 group"
                            >
                              <span className="text-[12px] font-bold text-white group-hover:text-[#c82d75] transition-colors">{item.label}</span>
                              <span className="text-[11px] text-gray-400 truncate">{item.text}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {selectedFile && (
                  <div className="flex items-center bg-white/5 rounded-lg px-3 py-1.5 text-[11px] font-medium text-gray-300 shadow-sm border border-white/10 w-full sm:w-auto max-w-[200px]">
                    <Paperclip className="w-3 h-3 mr-1.5 shrink-0 text-[#c82d75]" />
                    <span className="truncate flex-1">{selectedFile.name}</span>
                    <button onClick={() => setSelectedFile(null)} className="ml-2 text-gray-400 hover:text-red-400 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                {/* Hidden File Input */}
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,application/pdf" />
                
                {/* Paperclip Button */}
                <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3.5 bg-white/5 text-gray-400 hover:text-[#c82d75] hover:bg-white/10 transition-colors rounded-xl shrink-0">
                  <Paperclip className="w-5 h-5" />
                </button>

                <input 
                  type="text" 
                  placeholder={isInternalNote ? "Type a private note... (Ctrl+Enter to post, Alt+N to toggle)" : "Type your reply... (Ctrl+Enter to send, Alt+N for note)"} 
                  value={replyContent} 
                  onChange={(e) => setReplyContent(e.target.value)} 
                  onKeyDown={handleKeyDown as any}
                  className={`flex-1 border rounded-xl px-5 py-4 text-[15px] focus:outline-none focus:ring-1 focus:border-transparent transition-all placeholder:text-gray-500 ${isInternalNote ? 'bg-amber-900/20 border-amber-500/30 focus:ring-amber-500 text-amber-100 placeholder:text-amber-700/50' : 'bg-[#050b1b] border-white/10 focus:ring-[#c82d75] text-white'}`} 
                />
                <button type="submit" disabled={loading || (!replyContent.trim() && !selectedFile)} className={`px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-lg ${isInternalNote ? 'bg-amber-500 hover:bg-amber-600 text-amber-950' : 'bg-[#c82d75] hover:bg-[#a62460] text-white'}`}><Send className="w-5 h-5" /></button>
              </div>
            </form>
          ) : (
            ticket.status === 'CLOSED' ? (
              <div className="w-full py-3 bg-white/5 text-gray-500 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center text-xs border border-white/5">
                Ticket is Closed
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-[#050b1b] border border-white/10 rounded-2xl">
                <div className="flex items-center gap-2.5 text-xs text-gray-300">
                  {isAiDisabled ? (
                    <span className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <ShieldAlert className="w-4 h-4" /> AI Paused (Token Saver Active)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <Bot className="w-4 h-4 animate-pulse text-emerald-400" /> AI Auto-Pilot Active
                    </span>
                  )}
                  <span className="text-gray-500 hidden md:inline">• Intervene anytime to stop AI and take over</span>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleIntervene}
                    disabled={loading}
                    className="flex-1 sm:flex-none px-4 py-2 bg-[#c82d75] hover:bg-[#a62460] text-white text-xs font-bold rounded-xl uppercase tracking-wider transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" /> Take Over &amp; Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleAi(!isAiDisabled)}
                    className="px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                  >
                    {isAiDisabled ? 'Resume AI' : 'Pause AI'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>

      <div className={`absolute inset-0 xl:relative xl:inset-auto xl:flex transition-transform ${showMobileContext ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'} z-20`}>
        <TicketContext
          messages={messages}
          ticket={ticket}
          loading={loading}
          onPickTicket={handleIntervene}
          onEndChat={() => setDialog({ isOpen: true, title: 'End Conversation', message: 'Are you sure you want to close this chat?', action: () => { onEndChat(); setDialog(null); }})}
          onReopenTicket={() => setDialog({ isOpen: true, title: 'Reopen Ticket', message: 'Are you sure you want to reopen this ticket?', action: () => { onReopenTicket(); setDialog(null); }})}
          onToggleAi={handleToggleAi}
          onForceEndChat={handleForceEndChat}
          onCloseMobile={() => setShowMobileContext(false)}
        />
      </div>
    </div>
  );
}
