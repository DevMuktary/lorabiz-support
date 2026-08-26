import React from 'react';
import { Ticket, Message } from '@/types/dashboard';
import { Info, User, XCircle, RefreshCw, Phone, Mail, MessageSquare, Clock, X, Bot, ShieldAlert, Zap, ShieldCheck } from 'lucide-react';

interface TicketContextProps {
  ticket: Ticket;
  messages: Message[];
  loading: boolean;
  onPickTicket: () => void;
  onEndChat: () => void;
  onReopenTicket: () => void;
  onToggleAi?: (disable: boolean) => void;
  onForceEndChat?: () => void;
  onCloseMobile: () => void;
}

export default function TicketContext({
  ticket, messages, loading,
  onPickTicket, onEndChat, onReopenTicket, onToggleAi, onForceEndChat, onCloseMobile
}: TicketContextProps) {
  
  // Use aggressive filtering to guarantee we don't accidentally grab a system message name
  const cleanMessages = messages.filter(msg => {
    const text = msg.content || '';
    if (msg.senderType?.toUpperCase() === 'SYSTEM') return false;
    if (text.includes('[System:')) return false;
    return true;
  });

  const realCustomerName = cleanMessages.slice().reverse().find(m => m.senderType === 'CUSTOMER')?.senderName;
  const displayIdentifier = ticket.customerPhone || ticket.customerEmail || 'Anonymous User';
  const isAiDisabled = !!ticket.aiDisabled;

  return (
    <div className="w-full xl:w-80 2xl:w-96 border-l border-white/5 bg-[#050b1b] flex flex-col h-full shrink-0 shadow-2xl xl:shadow-none overflow-y-auto custom-scrollbar">
      
      <div className="p-6 border-b border-white/5 bg-[#0d152b] relative">
        <button onClick={onCloseMobile} className="absolute top-6 right-6 xl:hidden text-gray-400 hover:text-white bg-white/5 rounded-full p-1"><X className="w-5 h-5" /></button>

        <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">Customer Details</h3>
        
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 rounded-full bg-[#1a233a] border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
            <User className="w-6 h-6 text-gray-400" />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-white truncate text-lg">
              {realCustomerName || displayIdentifier}
            </p>
            <div className="flex flex-col items-start mt-0.5">
              {realCustomerName && <span className="text-[11px] text-gray-400">{displayIdentifier}</span>}
              <p className="text-[10px] mt-1 font-bold text-[#c82d75] uppercase tracking-widest flex items-center gap-1.5">
                {ticket.sourceChannel === 'WHATSAPP' && <Phone className="w-3 h-3" />}
                {ticket.sourceChannel === 'EMAIL' && <Mail className="w-3 h-3" />}
                {ticket.sourceChannel === 'IN_APP' && <MessageSquare className="w-3 h-3" />}
                {ticket.sourceChannel}
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2 text-[11px] text-gray-400 font-medium bg-white/5 p-2 rounded-lg inline-flex border border-white/5">
          <Clock className="w-3.5 h-3.5 text-gray-300" />
          Opened: {new Date(ticket.$createdAt).toLocaleString()}
        </div>
      </div>

      <div className="p-6 flex-1 space-y-6">
        
        {/* 🤖 ADMIN AI GUARD & TOKEN SAVER CONTROLS */}
        {ticket.status !== 'CLOSED' && (
          <div className="bg-[#0d152b] border border-white/10 rounded-2xl p-4 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-[#c82d75]" /> AI Bot Guard
              </span>
              <span className={`text-[9px] px-2 py-0.5 rounded font-black uppercase tracking-wider ${
                isAiDisabled ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
              }`}>
                {isAiDisabled ? 'AI Paused' : 'AI Active'}
              </span>
            </div>

            <p className="text-[11px] text-gray-400 leading-relaxed">
              {isAiDisabled 
                ? 'Lora AI is paused for this ticket. Customer messages will not consume AI tokens.' 
                : 'Lora AI is actively answering messages on auto-pilot.'}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onToggleAi?.(!isAiDisabled)}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${
                  isAiDisabled
                    ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}
              >
                {isAiDisabled ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                <span>{isAiDisabled ? 'Resume AI' : 'Pause AI'}</span>
              </button>

              <button
                type="button"
                onClick={onPickTicket}
                disabled={ticket.status === 'IN_PROGRESS'}
                className="py-2 px-3 rounded-xl text-xs font-bold bg-[#c82d75] hover:bg-[#a62460] text-white transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>{ticket.status === 'IN_PROGRESS' ? 'Assigned' : 'Take Over'}</span>
              </button>
            </div>
          </div>
        )}

        {/* AGENT ACTIONS */}
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Ticket Lifecycle</h3>
          
          <div className="space-y-2">
            {ticket.status === 'PENDING_AGENT' && (
              <button onClick={onPickTicket} disabled={loading} className="w-full py-3.5 bg-[#c82d75] hover:bg-[#a62460] text-white rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-[0_10px_20px_rgba(200,45,117,0.15)] flex items-center justify-center gap-2"><User className="w-4 h-4" /> Accept Chat</button>
            )}

            {ticket.status === 'IN_PROGRESS' && (
              <button onClick={onEndChat} disabled={loading} className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-red-500/20"><XCircle className="w-4 h-4" /> End Conversation</button>
            )}

            {ticket.status === 'CLOSED' && (
              <button onClick={onReopenTicket} disabled={loading} className="w-full py-3.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-500/20"><RefreshCw className="w-4 h-4" /> Reopen Ticket</button>
            )}

            {ticket.status === 'OPEN' && (
              <button onClick={onPickTicket} disabled={loading} className="w-full py-3.5 bg-[#c82d75] hover:bg-[#a62460] text-white rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"><Zap className="w-4 h-4" /> Intervene / Take Over</button>
            )}

            {ticket.status !== 'CLOSED' && (
              <button onClick={onForceEndChat} disabled={loading} className="w-full py-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 border border-red-500/20"><XCircle className="w-3.5 h-3.5" /> Force Terminate Chat</button>
            )}
          </div>
        </div>

        {ticket.aiSummary && (
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#c82d75] mb-3 flex items-center gap-1.5"><Info className="w-4 h-4" /> AI Context Summary</h3>
            <div className="bg-[#c82d75]/10 border border-[#c82d75]/20 rounded-xl p-5 shadow-inner">
              <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-medium">{ticket.aiSummary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
