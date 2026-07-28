import React from 'react';
import { UserButton } from '@clerk/nextjs';
import { Phone, Mail, MessageSquare, CheckCircle2, Bot } from 'lucide-react';
import { Ticket } from '@/types/dashboard';

interface TicketQueueProps {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  onSelectTicket: (ticket: Ticket) => void;
}

export default function TicketQueue({ tickets, selectedTicket, onSelectTicket }: TicketQueueProps) {
  return (
    <div className={`w-full md:w-[350px] lg:w-[400px] border-r border-gray-200 flex flex-col bg-white ${selectedTicket ? 'hidden md:flex' : 'flex'} shadow-[2px_0_10px_rgba(0,0,0,0.03)] z-10 shrink-0`}>
      <header className="p-5 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#000000] flex items-center justify-center shadow-md">
            <Bot className="w-4 h-4 text-[#8B2D75]" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">Active Queue</h1>
        </div>
        <UserButton />
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F8FAFC]">
        {tickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-gray-400" />
            <p className="text-sm font-medium">Inbox is empty.</p>
          </div>
        ) : (
          tickets.map((t) => (
            <div
              key={t.$id}
              onClick={() => onSelectTicket(t)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                selectedTicket?.$id === t.$id
                  ? 'bg-black border-black text-white shadow-lg'
                  : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold flex items-center gap-2 truncate uppercase tracking-wider">
                  {t.sourceChannel === 'WHATSAPP' && <Phone className={`w-3.5 h-3.5 ${selectedTicket?.$id === t.$id ? 'text-[#8B2D75]' : 'text-emerald-500'}`} />}
                  {t.sourceChannel === 'EMAIL' && <Mail className={`w-3.5 h-3.5 ${selectedTicket?.$id === t.$id ? 'text-[#8B2D75]' : 'text-sky-500'}`} />}
                  {t.sourceChannel === 'IN_APP' && <MessageSquare className={`w-3.5 h-3.5 ${selectedTicket?.$id === t.$id ? 'text-[#8B2D75]' : 'text-indigo-500'}`} />}
                  <span className="truncate">{t.customerPhone || t.customerEmail || `Ticket #${t.$id.slice(-4)}`}</span>
                </span>
                
                <span
                  className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest shrink-0 ${
                    t.status === 'PENDING_AGENT'
                      ? 'bg-[#8B2D75] text-white animate-pulse'
                      : t.status === 'IN_PROGRESS'
                      ? 'bg-blue-600 text-white'
                      : t.status === 'CLOSED'
                      ? 'bg-red-100 text-red-600'
                      : selectedTicket?.$id === t.$id
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              <p className={`text-sm truncate font-medium ${selectedTicket?.$id === t.$id ? 'text-gray-300' : 'text-gray-500'}`}>
                {t.status === 'PENDING_AGENT' ? 'Needs human assistance...' : t.status === 'CLOSED' ? 'Conversation ended.' : 'AI is handling conversation.'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
