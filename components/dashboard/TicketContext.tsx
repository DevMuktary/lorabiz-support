import React from 'react';
import { Ticket } from '@/types/dashboard';
import { Info, User, XCircle, RefreshCw, Phone, Mail, MessageSquare, Clock } from 'lucide-react';

interface TicketContextProps {
  ticket: Ticket;
  loading: boolean;
  onPickTicket: () => void;
  onEndChat: () => void;
  onReopenTicket: () => void;
}

export default function TicketContext({ ticket, loading, onPickTicket, onEndChat, onReopenTicket }: TicketContextProps) {
  return (
    <div className="w-80 lg:w-96 border-l border-gray-200 bg-white hidden xl:flex flex-col h-full shrink-0 z-10 overflow-y-auto custom-scrollbar">
      <div className="p-6 border-b border-gray-100 bg-gray-50/50">
        <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Customer Details</h3>
        
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
            <User className="w-5 h-5 text-gray-500" />
          </div>
          <div className="overflow-hidden">
            <p className="font-bold text-gray-900 truncate text-lg">
              {ticket.customerPhone || ticket.customerEmail || 'Anonymous User'}
            </p>
            <p className="text-xs font-semibold text-[#8B2D75] uppercase tracking-wider flex items-center gap-1">
              {ticket.sourceChannel === 'WHATSAPP' && <Phone className="w-3 h-3" />}
              {ticket.sourceChannel === 'EMAIL' && <Mail className="w-3 h-3" />}
              {ticket.sourceChannel === 'IN_APP' && <MessageSquare className="w-3 h-3" />}
              {ticket.sourceChannel}
            </p>
          </div>
        </div>
        
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 font-medium">
          <Clock className="w-3.5 h-3.5" />
          Opened: {new Date(ticket.$createdAt).toLocaleString()}
        </div>
      </div>

      <div className="p-6 flex-1 space-y-6">
        {/* ACTION BUTTONS */}
        <div>
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3">Actions</h3>
          {ticket.status === 'PENDING_AGENT' && (
            <button
              onClick={onPickTicket}
              disabled={loading}
              className="w-full py-3.5 bg-black hover:bg-gray-900 text-[#8B2D75] rounded-xl font-bold uppercase tracking-widest transition-all disabled:opacity-50 shadow-md flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4 text-white" />
              <span className="text-white">Accept Chat</span>
            </button>
          )}

          {ticket.status === 'IN_PROGRESS' && (
            <button 
              onClick={onEndChat}
              disabled={loading}
              className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-red-100"
            >
              <XCircle className="w-4 h-4" />
              End Conversation
            </button>
          )}

          {ticket.status === 'CLOSED' && (
            <button 
              onClick={onReopenTicket}
              disabled={loading}
              className="w-full py-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold uppercase tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2 border border-emerald-100"
            >
              <RefreshCw className="w-4 h-4" />
              Reopen Ticket
            </button>
          )}

          {(ticket.status === 'OPEN' || ticket.status === 'RESOLVED') && (
            <div className="w-full py-3.5 bg-gray-50 text-gray-400 rounded-xl font-semibold uppercase tracking-widest flex items-center justify-center text-xs text-center border border-gray-100">
              Controlled by AI
            </div>
          )}
        </div>

        {/* AI SUMMARY */}
        {ticket.aiSummary && (
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-[#8B2D75]" />
              AI Context Summary
            </h3>
            <div className="bg-[#FFF8FA] border border-[#8B2D75]/20 rounded-xl p-4 shadow-sm">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {ticket.aiSummary}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
