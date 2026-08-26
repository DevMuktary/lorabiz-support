import React, { useState, useEffect } from 'react';
import { UserButton } from '@clerk/nextjs';
import { Phone, Mail, MessageSquare, CheckCircle2, Bot, Moon, Volume2, VolumeX, Bell, Search, X } from 'lucide-react';
import { Ticket } from '@/types/dashboard';
import { isSoundMuted, setSoundMuted, playNotificationPing } from '@/lib/sound';

interface TicketQueueProps {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  onSelectTicket: (ticket: Ticket) => void;
  businessStatus: { isOnline: boolean; message: string };
}

type FilterType = 'ALL' | 'WHATSAPP' | 'IN_APP' | 'EMAIL';

export default function TicketQueue({ tickets, selectedTicket, onSelectTicket, businessStatus }: TicketQueueProps) {
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [muted, setMuted] = useState(false);
  const [hasNotificationPermission, setHasNotificationPermission] = useState(true);

  useEffect(() => {
    setMuted(isSoundMuted());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasNotificationPermission(Notification.permission === 'granted');
    }
  }, []);

  const handleToggleMute = () => {
    const nextMuted = !muted;
    setMuted(nextMuted);
    setSoundMuted(nextMuted);
    if (!nextMuted) {
      playNotificationPing();
    }
  };

  const handleRequestNotifications = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setHasNotificationPermission(permission === 'granted');
    }
  };

  const queryClean = searchQuery.toLowerCase().trim();
  const filteredTickets = tickets.filter(t => {
    const matchesChannel = filter === 'ALL' || t.sourceChannel === filter;
    if (!matchesChannel) return false;
    if (!queryClean) return true;

    return (
      (t.title && t.title.toLowerCase().includes(queryClean)) ||
      (t.customerEmail && t.customerEmail.toLowerCase().includes(queryClean)) ||
      (t.customerPhone && t.customerPhone.toLowerCase().includes(queryClean)) ||
      (t.lastMessage && t.lastMessage.toLowerCase().includes(queryClean)) ||
      (t.$id && t.$id.toLowerCase().includes(queryClean))
    );
  });

  return (
    <div className="w-full md:w-[360px] lg:w-[420px] h-full flex flex-col bg-[#050b1b] border-r border-white/10 z-10">
      
      {/* Header */}
      <header className="p-5 border-b border-white/10 flex items-center justify-between bg-[#050b1b] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#c82d75] flex items-center justify-center shadow-lg shadow-[#c82d75]/20">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <h1 className="font-extrabold text-lg text-white tracking-tight">Agent Hub</h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle Button */}
          <button
            onClick={handleToggleMute}
            title={muted ? "Sound muted (click to unmute)" : "Sound on (click to mute)"}
            className={`p-2 rounded-lg border transition-all ${
              muted 
                ? 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' 
                : 'bg-white/5 border-white/10 text-emerald-400 hover:bg-white/10'
            }`}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          {/* Desktop Push Notification Request (if not yet granted) */}
          {!hasNotificationPermission && (
            <button
              onClick={handleRequestNotifications}
              title="Enable desktop notifications"
              className="p-2 rounded-lg bg-[#c82d75]/10 border border-[#c82d75]/20 text-[#c82d75] hover:bg-[#c82d75]/20 transition-colors"
            >
              <Bell className="w-4 h-4 animate-pulse" />
            </button>
          )}

          <div className="ring-2 ring-white/10 rounded-full">
            <UserButton appearance={{ elements: { avatarBox: "w-8 h-8" } }} />
          </div>
        </div>
      </header>

      {/* Offline Banner */}
      {!businessStatus.isOnline && (
        <div className="bg-[#131b33] border-b border-white/5 p-3 flex items-start gap-3 shrink-0">
          <div className="bg-indigo-500/20 p-1.5 rounded-md mt-0.5">
            <Moon className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-200">Outside Business Hours</h4>
            <p className="text-[11px] text-gray-400 leading-snug mt-0.5">
              You are officially closed for the day and expected to return by 9:00 AM. You can still manually reply to active tickets below.
            </p>
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="px-4 pt-3 pb-1 bg-[#050b1b] shrink-0">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Search tickets, email, topic..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#0d152b] border border-white/10 rounded-xl pl-9 pr-8 py-2 text-[13px] text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-[#c82d75] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 text-gray-400 hover:text-white p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Channel Tabs */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0 bg-[#050b1b]">
        <div className="flex bg-[#0d152b] rounded-lg p-1 gap-1">
          {['ALL', 'WHATSAPP', 'IN_APP', 'EMAIL'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab as FilterType)}
              className={`flex-1 py-1.5 text-[10px] font-bold tracking-wider rounded-md transition-all ${
                filter === tab 
                  ? 'bg-[#c82d75] text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Ticket List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {filteredTickets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-3">
            <CheckCircle2 className="w-12 h-12 text-[#c82d75]/40" />
            <p className="text-sm font-medium text-gray-400">No tickets found.</p>
          </div>
        ) : (
          filteredTickets.map((t) => (
            <div
              key={t.$id}
              onClick={() => onSelectTicket(t)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer group ${
                selectedTicket?.$id === t.$id
                  ? 'bg-[#0d152b] border-[#c82d75] shadow-[0_0_15px_rgba(200,45,117,0.15)]'
                  : 'bg-[#0d152b]/50 border-white/5 hover:border-white/20 hover:bg-[#0d152b]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold flex items-center gap-2 truncate uppercase tracking-wider text-gray-200">
                  {t.sourceChannel === 'WHATSAPP' && <Phone className="w-3.5 h-3.5 text-[#25D366]" />}
                  {t.sourceChannel === 'EMAIL' && <Mail className="w-3.5 h-3.5 text-sky-400" />}
                  {t.sourceChannel === 'IN_APP' && <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />}
                  <span className="truncate">{t.customerPhone || t.customerEmail || `Ticket #${t.$id.slice(-4)}`}</span>
                </span>
                
                <span
                  className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest shrink-0 ${
                    t.status === 'PENDING_AGENT'
                      ? 'bg-[#c82d75] text-white animate-pulse'
                      : t.status === 'IN_PROGRESS'
                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20'
                      : t.status === 'CLOSED'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/10'
                      : 'bg-white/5 text-gray-400'
                  }`}
                >
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              <p className={`text-sm truncate font-medium ${selectedTicket?.$id === t.$id ? 'text-gray-300' : 'text-gray-500'}`}>
                {t.status === 'PENDING_AGENT' ? 'Human assistance requested...' : t.lastMessage || 'AI is handling conversation.'}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
