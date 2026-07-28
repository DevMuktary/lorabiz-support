import React, { useState, useRef, useEffect } from 'react';
import { Ticket, Message } from '@/types/dashboard';
import TicketContext from './TicketContext';
import { ChevronLeft, Send, Lock } from 'lucide-react';

interface ChatAreaProps {
  ticket: Ticket;
  messages: Message[];
  isCustomerTyping: boolean;
  loading: boolean;
  onBack: () => void;
  onPickTicket: () => void;
  onEndChat: () => void;
  onReopenTicket: () => void;
  onSendMessage: (content: string, isInternalNote: boolean) => void;
}

export default function ChatArea({
  ticket, messages, isCustomerTyping, loading,
  onBack, onPickTicket, onEndChat, onReopenTicket, onSendMessage
}: ChatAreaProps) {
  const [replyContent, setReplyContent] = useState('');
  const [isInternalNote, setIsInternalNote] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isCustomerTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim()) return;
    onSendMessage(replyContent, isInternalNote);
    setReplyContent('');
  };

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* CENTER PANE: Messages & Input */}
      <div className="flex-1 flex flex-col bg-white min-w-0">
        
        {/* Mobile/Tablet Header (Context is moved here on small screens) */}
        <header className="px-4 py-3 md:px-6 md:py-4 border-b border-gray-100 bg-white shadow-sm flex items-center justify-between z-10 shrink-0 xl:hidden">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="md:hidden p-2 -ml-2 rounded-full hover:bg-gray-100 text-black transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div>
              <h2 className="font-bold text-black flex items-center gap-2 text-lg truncate max-w-[200px] sm:max-w-xs">
                {ticket.customerPhone || ticket.customerEmail || `Ticket #${ticket.$id.slice(-6)}`}
              </h2>
              <p className="text-xs font-semibold text-[#8B2D75] uppercase tracking-wider">
                via {ticket.sourceChannel}
              </p>
            </div>
          </div>
          
          {/* Mobile Quick Actions */}
          {ticket.status === 'PENDING_AGENT' && (
            <button onClick={onPickTicket} disabled={loading} className="px-4 py-2 bg-black text-[#8B2D75] rounded-lg text-xs font-bold uppercase tracking-wider">Accept</button>
          )}
          {ticket.status === 'IN_PROGRESS' && (
            <button onClick={onEndChat} disabled={loading} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase tracking-wider">End</button>
          )}
          {ticket.status === 'CLOSED' && (
            <button onClick={onReopenTicket} disabled={loading} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-lg text-xs font-bold uppercase tracking-wider">Reopen</button>
          )}
        </header>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-[#F8FAFC] custom-scrollbar">
          {messages.map((msg) => {
            const isInternal = msg.content.startsWith('[INTERNAL NOTE]');
            const displayContent = isInternal ? msg.content.replace('[INTERNAL NOTE]:', '').trim() : msg.content;
            
            return (
              <div key={msg.$id} className={`flex flex-col ${msg.senderType === 'AGENT' || isInternal ? 'items-end' : 'items-start'}`}>
                <div
                  className={`max-w-[85%] md:max-w-[70%] p-4 text-[15px] shadow-sm flex flex-col ${
                    isInternal
                      ? 'bg-amber-100 text-amber-900 border border-amber-200 rounded-2xl rounded-tr-sm' // Internal Note Style
                    : msg.senderType === 'AGENT'
                      ? 'bg-black text-white rounded-2xl rounded-tr-sm'
                    : msg.senderType === 'ASSISTANT'
                      ? 'bg-white text-black border border-gray-200 rounded-2xl rounded-tl-sm'
                    : msg.senderType === 'SYSTEM'
                      ? 'bg-gray-100 text-gray-500 rounded-2xl rounded-tr-sm text-center italic text-sm self-center mx-auto'
                    : 'bg-white text-black border border-gray-200 rounded-2xl rounded-tl-sm' // Customer Style
                  }`}
                >
                  {isInternal && (
                    <div className="flex items-center gap-1.5 mb-1 text-amber-700 font-bold text-[10px] uppercase tracking-wider">
                      <Lock className="w-3 h-3" /> Internal Note (Hidden from Customer)
                    </div>
                  )}
                  {msg.attachmentUrl && (
                    <img src={msg.attachmentUrl} alt="Attachment" className="mb-3 max-w-full rounded-xl border border-black/10" />
                  )}
                  <span className="leading-relaxed whitespace-pre-wrap">{displayContent}</span>
                  
                  {msg.senderType !== 'SYSTEM' && (
                    <span className={`block text-[10px] font-bold mt-2 uppercase tracking-wider opacity-70 ${msg.senderType === 'AGENT' || isInternal ? 'text-right text-[#8B2D75]' : 'text-left'}`}>
                      {msg.senderName} • {new Date(msg.$createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {isCustomerTyping && (
            <div className="flex justify-start">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex space-x-1.5 items-center">
                <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-[#8B2D75] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 md:p-4 bg-white border-t border-gray-100 shrink-0 pb-safe">
          {ticket.status === 'IN_PROGRESS' ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-2 max-w-4xl mx-auto">
              
              {/* Note Toggle */}
              <div className="flex items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={() => setIsInternalNote(false)}
                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors ${!isInternalNote ? 'bg-gray-200 text-gray-800' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                  Reply to Customer
                </button>
                <button
                  type="button"
                  onClick={() => setIsInternalNote(true)}
                  className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 ${isInternalNote ? 'bg-amber-100 text-amber-800' : 'text-gray-400 hover:bg-gray-100'}`}
                >
                  <Lock className="w-3 h-3" /> Add Internal Note
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={isInternalNote ? "Type a private note..." : "Type your reply to the customer..."}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  className={`flex-1 border rounded-xl px-5 py-4 text-[16px] focus:outline-none focus:ring-2 focus:border-transparent transition-all placeholder:text-gray-400 ${
                    isInternalNote 
                      ? 'bg-amber-50/50 border-amber-200 focus:ring-amber-500 text-amber-900 placeholder:text-amber-300' 
                      : 'bg-[#F8FAFC] border-gray-200 focus:ring-[#8B2D75] text-gray-900'
                  }`}
                />
                <button
                  type="submit"
                  disabled={loading || !replyContent.trim()}
                  className={`px-6 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md ${
                    isInternalNote ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-black hover:bg-gray-900 text-[#8B2D75]'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </form>
          ) : (
            <div className="w-full py-4 bg-gray-50 text-gray-400 rounded-xl font-semibold uppercase tracking-widest flex items-center justify-center text-xs">
              {ticket.status === 'CLOSED' ? 'Ticket is closed' : 'Ticket is currently controlled by AI'}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Ticket Context (Desktop Only) */}
      <TicketContext 
        ticket={ticket}
        loading={loading}
        onPickTicket={onPickTicket}
        onEndChat={onEndChat}
        onReopenTicket={onReopenTicket}
      />
    </div>
  );
}
