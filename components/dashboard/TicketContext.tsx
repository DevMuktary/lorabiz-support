import React from 'react';
import { Ticket, Message } from '@/types/dashboard';
import { Info, User, XCircle, RefreshCw, Phone, Mail, MessageSquare, Clock, X } from 'lucide-react';

interface TicketContextProps {
  ticket: Ticket;
  messages: Message[];
  loading: boolean;
  onPickTicket: () => void;
  onEndChat: () => void;
  onReopenTicket: () => void;
  onCloseMobile: () => void;
}

export default function TicketContext({ ticket, messages, loading, onPickTicket, onEndChat, onReopenTicket, onCloseMobile }: TicketContextProps) {
  
  // Extract Verified Name from messages array
  const realCustomerName = messages.slice().reverse().find(m => m.senderType === 'CUSTOMER')?.senderName;
  const displayIdentifier = ticket.customerPhone || ticket.customerEmail || 'Anonymous User';

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

      <div className="p-6 flex-1 space-y-8">
        <div>
          <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Agent Actions</h3>
          {ticket.status === 'PENDING_AGENT' && (
            <button onClick={onPickTicket} disabled={loading} className="w-full py-4 bg-[#c82d75] hover:bg-[#a62460] text-white rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 shadow-[0_10px_20px_rgba(200,45,117,0.15)] flex items-center justify-center gap-2"><User className="w-4 h-4" /> Accept Chat</button>
          )}

          {ticket.status === 'IN_PROGRESS' && (
            <button onClick={onEndChat} disabled={loading} className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-red-500/20"><XCircle className="w-4 h-4" /> End Conversation</button>
          )}

          {ticket.status === 'CLOSED' && (
            <button onClick={onReopenTicket} disabled={loading} className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-xl font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-500/20"><RefreshCw className="w-4 h-4" /> Reopen Ticket</button>
          )}

          {(ticket.status === 'OPEN' || ticket.status === 'RESOLVED') && (
            <div className="w-full py-4 bg-white/5 text-gray-500 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center text-xs border border-white/5">Controlled by AI</div>
          )}
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
