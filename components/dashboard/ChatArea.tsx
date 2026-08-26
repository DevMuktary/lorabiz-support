import React, { useState, useRef, useEffect } from 'react';
import { Ticket, Message } from '@/types/dashboard';
import TicketContext from './TicketContext';
import { ChevronLeft, Send, Lock, Info, ArrowDown, User, XCircle, RefreshCw, Paperclip, X, Zap } from 'lucide-react';

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
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [dialog, setDialog] = useState<{ isOpen: boolean, title: string, message: string, action: () => void } | null>(null);

  // 🚀 NEW FILE STATE 🚀
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

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 150);
    }
  };

  useEffect(() => {
    if (!isScrolledUp && !isFetchingChat) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
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
    setSelectedFile(null); // Clear file after send
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
              <button onClick={dialog.action} className="px-5 py-2 rounded-lg text-sm font-bold bg-[#c82d75] hover:bg-[#a62460] text-white transition-colors">Okay</button>
            </div>
          </div>
        </div>
      )}

      {/* CENTER PANE */}
      <div className={`flex-1 flex flex-col min-w-0 transition-transform ${showMobileContext ? '-translate-x-full lg:translate-x-0' : ''} relative`}>
        
        <header className="px-4 py-3 md:px-6 md:py-5 border-b border-white/5 bg-[#0d152b] flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full hover:bg-white/10 text-gray-300 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="font-bold text-white flex items-center gap-2 text-lg truncate max-w-[180px] sm:max-w-xs">
                {realCustomerName || displayIdentifier}
              </h2>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest mt-0.5">
                <span className="text-[#c82d75]">via {ticket.sourceChannel}</span>
                {realCustomerName && <span className="text-gray-500 lowercase normal-case tracking-normal">({displayIdentifier})</span>}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMobileContext(!showMobileContext)} className="xl:hidden p-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
              <Info className="w-5 h-5" />
            </button>

            {ticket.status === 'PENDING_AGENT' && (
              <button onClick={() => setDialog({ isOpen: true, title: 'Accept Chat', message: 'Are you sure you want to assign this chat to yourself?', action: () => { onPickTicket(); setDialog(null); }})} disabled={loading} className="px-4 py-2 bg-[#c82d75] hover:bg-[#a62460] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors shadow-lg flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> Accept</button>
            )}
            {ticket.status === 'IN_PROGRESS' && (
              <button onClick={() => setDialog({ isOpen: true, title: 'End Conversation', message: 'Are you sure you want to close this chat? The customer will need to start a new flow.', action: () => { onEndChat(); setDialog(null); }})} disabled={loading} className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5"/> End</button>
            )}
            {ticket.status === 'CLOSED' && (
              <button onClick={() => setDialog({ isOpen: true, title: 'Reopen Ticket', message: 'Are you sure you want to reopen this ticket? You will be assigned as the active agent.', action: () => { onReopenTicket(); setDialog(null); }})} disabled={loading} className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5"/> Reopen</button>
            )}
          </div>
        </header>

        {/* FEED AREA */}
        <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">
          {isFetchingChat ? (
            <div className="animate-pulse space-y-6 flex flex-col justify-end h-full">
              <div className="flex justify-start"><div className="bg-white/5 w-2/3 h-16 rounded-2xl"></div></div>
              <div className="flex justify-end"><div className="bg-[#c82d75]/30 w-1/2 h-20 rounded-2xl"></div></div>
              <div className="flex justify-start"><div className="bg-white/5 w-3/4 h-12 rounded-2xl"></div></div>
            </div>
          ) : (
            <div className="space-y-6">
              {cleanMessages.map((msg) => {
                const isInternal = msg.content.startsWith('[INTERNAL NOTE]');
                const displayContent = isInternal ? msg.content.replace('[INTERNAL NOTE]:', '').trim() : msg.content;
                
                return (
                  <div key={msg.$id} className={`flex flex-col ${msg.senderType === 'AGENT' || isInternal ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[70%] p-4 text-[15px] flex flex-col ${
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
                            className="max-w-full rounded-xl border border-white/10 cursor-pointer hover:opacity-80 transition-opacity" 
                            onClick={() => setLightboxImage(msg.attachmentUrl!)}
                            onError={(e) => {
                              // If it fails to load as an image, it's likely a PDF. Hide the broken image tag and show the link.
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.nextElementSibling?.classList.remove('hidden');
                            }}
                          />
                          <a 
                            href={msg.attachmentUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="hidden flex items-center justify-center gap-2 px-4 py-3 bg-white/10 rounded-xl text-sm font-medium hover:bg-white/20 transition-colors text-white border border-white/10"
                          >
                            📄 View Document
                          </a>
                        </div>
                      )}

                      {msg.content && <span className="leading-relaxed whitespace-pre-wrap">{displayContent}</span>}
                      
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
              
              {/* Note Toggle & Selected File Preview */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2 relative">
                  <button type="button" onClick={() => { setIsInternalNote(false); setShowQuickReplies(false); }} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${!isInternalNote ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>Reply Customer</button>
                  <button type="button" onClick={() => { setIsInternalNote(true); setShowQuickReplies(false); }} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${isInternalNote ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'text-gray-500 hover:bg-white/5'}`}><Lock className="w-3 h-3" /> Internal Note</button>
                  
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

                <input type="text" placeholder={isInternalNote ? "Type a private note..." : "Type your reply to the customer..."} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className={`flex-1 border rounded-xl px-5 py-4 text-[15px] focus:outline-none focus:ring-1 focus:border-transparent transition-all placeholder:text-gray-500 ${isInternalNote ? 'bg-amber-900/20 border-amber-500/30 focus:ring-amber-500 text-amber-100 placeholder:text-amber-700/50' : 'bg-[#050b1b] border-white/10 focus:ring-[#c82d75] text-white'}`} />
                <button type="submit" disabled={loading || (!replyContent.trim() && !selectedFile)} className={`px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-lg ${isInternalNote ? 'bg-amber-500 hover:bg-amber-600 text-amber-950' : 'bg-[#c82d75] hover:bg-[#a62460] text-white'}`}><Send className="w-5 h-5" /></button>
              </div>
            </form>
          ) : (
            <div className="w-full py-4 bg-white/5 text-gray-500 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center text-xs border border-white/5">
              {ticket.status === 'CLOSED' ? 'Ticket is closed' : 'Controlled by AI'}
            </div>
          )}
        </div>
      </div>

      <div className={`absolute inset-0 xl:relative xl:inset-auto xl:flex transition-transform ${showMobileContext ? 'translate-x-0' : 'translate-x-full xl:translate-x-0'} z-20`}>
        <TicketContext messages={messages} ticket={ticket} loading={loading} onPickTicket={() => setDialog({ isOpen: true, title: 'Accept Chat', message: 'Are you sure you want to assign this chat to yourself?', action: () => { onPickTicket(); setDialog(null); }})} onEndChat={() => setDialog({ isOpen: true, title: 'End Conversation', message: 'Are you sure you want to close this chat?', action: () => { onEndChat(); setDialog(null); }})} onReopenTicket={() => setDialog({ isOpen: true, title: 'Reopen Ticket', message: 'Are you sure you want to reopen this ticket?', action: () => { onReopenTicket(); setDialog(null); }})} onCloseMobile={() => setShowMobileContext(false)} />
      </div>
    </div>
  );
}
