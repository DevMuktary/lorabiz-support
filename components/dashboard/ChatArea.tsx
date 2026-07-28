import React, { useState, useRef, useEffect } from 'react';
import { Ticket, Message } from '@/types/dashboard';
import TicketContext from './TicketContext';
import { ChevronLeft, Send, Lock, Info, ArrowDown, User, XCircle, RefreshCw } from 'lucide-react';

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
  onSendMessage: (content: string, isInternalNote: boolean) => void;
}

export default function ChatArea({
  ticket, messages, isFetchingChat, isCustomerTyping, loading,
  onBack, onPickTicket, onEndChat, onReopenTicket, onSendMessage
}: ChatAreaProps) {
  const [replyContent, setReplyContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [showMobileContext, setShowMobileContext] = useState(false); 
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [dialog, setDialog] = useState<{ isOpen: boolean, title: string, message: string, action: () => void } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setIsScrolledUp(scrollHeight - scrollTop - clientHeight > 150);
    }
  };

  useEffect(() => {
    if (!isScrolledUp && !isFetchingChat) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isCustomerTyping, isFetchingChat]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    onSendMessage(replyContent, isInternalNote);
    setReplyContent('');
    setIsScrolledUp(false); 
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  // 1. EXTRACT REAL NAME
  const realCustomerName = messages.slice().reverse().find(m => m.senderType === 'CUSTOMER')?.senderName;
  const displayIdentifier = ticket.customerPhone || ticket.customerEmail || `Ticket #${ticket.$id.slice(-6)}`;

  // 2. FILTER OUT UGLY SYSTEM MESSAGES (Keep only Internal Notes)
  const cleanMessages = messages.filter(msg => msg.senderType !== 'SYSTEM' || msg.content.startsWith('[INTERNAL NOTE]'));

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0a1126] relative">
      
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
                          ? 'bg-[#c82d75] text-white rounded-2xl rounded-tr-sm shadow-md' // AGENT COLOR
                        : msg.senderType === 'ASSISTANT'
                          ? 'bg-[#1e1b4b] text-indigo-100 border border-indigo-500/30 rounded-2xl rounded-tl-sm' // DISTINCT LORA COLOR
                        : 'bg-[#131b33] text-gray-200 border border-white/5 rounded-2xl rounded-tl-sm' // CUSTOMER COLOR
                      }`}
                    >
                      {isInternal && (
                        <div className="flex items-center gap-1.5 mb-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-wider">
                          <Lock className="w-3 h-3" /> Internal Note
                        </div>
                      )}
                      {msg.attachmentUrl && (
                        <img src={msg.attachmentUrl} alt="Attachment" className="mb-3 max-w-full rounded-xl border border-white/10" />
                      )}
                      <span className="leading-relaxed whitespace-pre-wrap">{displayContent}</span>
                      
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

        {/* Scroll Button */}
        {isScrolledUp && !isFetchingChat && (
          <button onClick={() => { setIsScrolledUp(false); messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }} className="absolute bottom-24 right-6 bg-[#c82d75] text-white p-3 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.5)] hover:scale-105 transition-all z-20 flex items-center animate-bounce border border-white/10">
            <ArrowDown className="w-5 h-5" />
          </button>
        )}

        {/* Input Area */}
        <div className="p-3 md:p-5 bg-[#0d152b] border-t border-white/5 shrink-0 pb-safe z-10">
          {ticket.status === 'IN_PROGRESS' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-4xl mx-auto">
              <div className="flex items-center gap-2 px-1">
                <button type="button" onClick={() => setIsInternalNote(false)} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${!isInternalNote ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`}>Reply Customer</button>
                <button type="button" onClick={() => setIsInternalNote(true)} className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${isInternalNote ? 'bg-amber-500/20 text-amber-400 border border-amber-500/20' : 'text-gray-500 hover:bg-white/5'}`}><Lock className="w-3 h-3" /> Internal Note</button>
              </div>
              <div className="flex gap-2">
                <input type="text" placeholder={isInternalNote ? "Type a private note..." : "Type your reply to the customer..."} value={replyContent} onChange={(e) => setReplyContent(e.target.value)} className={`flex-1 border rounded-xl px-5 py-4 text-[15px] focus:outline-none focus:ring-1 focus:border-transparent transition-all placeholder:text-gray-500 ${isInternalNote ? 'bg-amber-900/20 border-amber-500/30 focus:ring-amber-500 text-amber-100 placeholder:text-amber-700/50' : 'bg-[#050b1b] border-white/10 focus:ring-[#c82d75] text-white'}`} />
                <button type="submit" disabled={loading || !replyContent.trim()} className={`px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-lg ${isInternalNote ? 'bg-amber-500 hover:bg-amber-600 text-amber-950' : 'bg-[#c82d75] hover:bg-[#a62460] text-white'}`}><Send className="w-5 h-5" /></button>
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
