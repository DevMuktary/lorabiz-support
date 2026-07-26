// components/SupportWidget.tsx
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { client } from '@/lib/appwrite-client';

const DATABASE_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || 'lorabiz_support';
const MESSAGES_COLLECTION_ID = process.env.NEXT_PUBLIC_APPWRITE_MESSAGES_COLLECTION_ID || 'messages';

interface Message {
  $id: string;
  senderType: 'CUSTOMER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  senderName: string;
  content: string;
  createdAt: string;
}

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Notify parent window (the main LoraBiz site) to resize the iframe
  const toggleWidget = (newState: boolean) => {
    setIsOpen(newState);
    if (typeof window !== 'undefined' && window.parent) {
      window.parent.postMessage(
        newState ? 'LORA_WIDGET_OPENED' : 'LORA_WIDGET_CLOSED', 
        '*' // In production, restrict '*' to your main LoraBiz domain for strict security
      );
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    if (!ticketId) return;

    const unsubscribe = client.subscribe(
      `databases.${DATABASE_ID}.collections.${MESSAGES_COLLECTION_ID}.documents`,
      (response: any) => {
        if (
          response.events.includes('databases.*.collections.*.documents.*.create') &&
          response.payload.ticketId === ticketId
        ) {
          setMessages((prev) => {
            const exists = prev.find((m) => m.$id === response.payload.$id);
            if (exists) return prev;
            return [...prev, response.payload as Message];
          });
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [ticketId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isClosed) return;

    const currentText = inputText;
    setInputText('');
    setIsTyping(true);

    const activeTicketId = ticketId || `TICKET_${Date.now()}`;
    if (!ticketId) setTicketId(activeTicketId);

    try {
      const response = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticketId: activeTicketId,
          message: currentText,
          senderId: 'USER_ID_PLACEHOLDER',
          senderName: 'Client',
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const data = await response.json();
      
      if (data.error && data.error.includes('closed')) {
         setIsClosed(true);
      }
    } catch (error) {
      console.error('Chat Error:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const handleEndChat = async () => {
    if (!ticketId) {
      toggleWidget(false);
      return;
    }

    try {
      await fetch('/api/support/ticket/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticketId }),
      });
      setIsClosed(true);
      setMessages((prev) => [
        ...prev,
        {
          $id: `SYS_${Date.now()}`,
          senderType: 'SYSTEM',
          senderName: 'System',
          content: 'You have ended this chat. A transcript will be sent to your email.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch (error) {
      console.error('Failed to close ticket:', error);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end w-full h-full justify-end pr-2 pb-2 pointer-events-none">
      {isOpen && (
        <div className="mb-4 w-[380px] h-[550px] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-[#0A192F]/20 pointer-events-auto">
          {/* Header */}
          <div className="bg-[#0A192F] px-4 py-4 flex justify-between items-center text-white">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-[#FFB300] animate-pulse"></div>
              <h3 className="font-semibold text-[15px] tracking-wide">LoraBiz Support</h3>
            </div>
            <div className="flex space-x-3 items-center">
              {!isClosed && (
                <button
                  onClick={handleEndChat}
                  className="text-xs text-[#FFB300] hover:text-white transition-colors uppercase tracking-wider font-semibold"
                >
                  End Chat
                </button>
              )}
              <button onClick={() => toggleWidget(false)} className="text-gray-300 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Chat Feed */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC] space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-sm text-gray-500 mt-10">
                <p>Send a message to start a secure session.</p>
              </div>
            )}

            {messages.map((msg) => {
              const isUser = msg.senderType === 'CUSTOMER';
              const isSystem = msg.senderType === 'SYSTEM';

              if (isSystem) {
                return (
                  <div key={msg.$id} className="text-center my-2">
                    <span className="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
                      {msg.content}
                    </span>
                  </div>
                );
              }

              return (
                <div key={msg.$id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
                      isUser
                        ? 'bg-[#0A192F] text-white rounded-br-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-bl-sm'
                    }`}
                  >
                    {!isUser && (
                      <span className="block text-[10px] font-bold text-[#FFB300] mb-1 uppercase tracking-wider">
                        {msg.senderName}
                      </span>
                    )}
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 flex space-x-1 items-center">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-white border-t border-gray-200">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isClosed}
                placeholder={isClosed ? "Chat ended." : "Type your message..."}
                className="flex-1 bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#0A192F] focus:border-[#0A192F] block w-full p-2.5 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isClosed}
                className="p-2.5 bg-[#0A192F] text-[#FFB300] rounded-lg hover:bg-[#0d213f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Launcher Button */}
      <button
        onClick={() => toggleWidget(!isOpen)}
        className="w-16 h-16 bg-[#0A192F] hover:bg-[#0d213f] text-[#FFB300] rounded-full shadow-xl flex items-center justify-center transition-transform hover:scale-105 pointer-events-auto"
      >
        {isOpen ? (
          // The "X" Close Icon
          <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          // The Headset/Mic Support Icon
          <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
            <path d="M19 22v-3"></path>
            <path d="M5 22v-3"></path>
            <path d="M21 14a9 9 0 0 0-18 0"></path>
            <path d="M14 20h2"></path>
          </svg>
        )}
      </button>
    </div>
  );
}
