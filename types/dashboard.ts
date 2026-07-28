export interface Ticket {
  $id: string;
  customerPhone?: string;
  customerEmail?: string;
  sourceChannel: 'WHATSAPP' | 'EMAIL' | 'IN_APP';
  status: 'OPEN' | 'PENDING_AGENT' | 'IN_PROGRESS' | 'CLOSED' | 'RESOLVED';
  lastMessage?: string;
  aiSummary?: string;
  assignedAgentId?: string;
  customerTyping?: boolean; 
  $createdAt: string;
  $updatedAt: string;
}

export interface Message {
  $id: string;
  ticketId: string;
  senderType: 'CUSTOMER' | 'ASSISTANT' | 'SYSTEM' | 'AGENT';
  senderName: string;
  content: string;
  $createdAt: string;
  attachmentUrl?: string;
}
