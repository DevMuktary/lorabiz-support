import OpenAI from 'openai';
import { LORABIZ_KNOWLEDGE_BASE } from './knowledge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processTicketWithAI(ticketId: string, history: any[]) {
  const systemPrompt = {
    role: 'system',
    content: `You are Lora, the official support AI for LoraBiz. You operate in a strictly closed system.

KNOWLEDGE BASE:
"""
${LORABIZ_KNOWLEDGE_BASE}
"""

CRITICAL RULES:
1. CONVERSATIONAL & PERSONAL: Review the chat history for any "[System: Customer Onboarded]" messages. If you find the customer's Name and Service Topic, greet them by their specific name, acknowledge their chosen topic, and immediately provide a helpful response tailored to their issue. Continue to use their name naturally throughout the conversation.
2. HANDLING UNKNOWN QUERIES: If the user asks ANYTHING outside your strict knowledge, DO NOT invent answers. Instead, politely state that you do not have that information and ask them: "Would you like me to connect you with a support agent?"
3. EMPATHY & DE-ESCALATION: If the user expresses anger, worry, or frustration, apologize sincerely and console them professionally before addressing the issue.
4. THE HANDOVER TRIGGER: If the user EXPLICITLY asks for a human agent, OR if they say "yes" when you offer to connect them, you MUST reply with EXACTLY this phrase and nothing else: TRIGGER_HANDOVER
5. TONE: Maintain a professional, high-end corporate tone, but remain warm and welcoming.`
  };

  const mappedHistory = history.map((msg: any) => ({
    role: msg.senderType === 'CUSTOMER' ? 'user' : (msg.senderType === 'SYSTEM' ? 'system' : 'assistant'),
    content: msg.content
  }));

  const aiMessages = [systemPrompt, ...mappedHistory];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: aiMessages as any,
      temperature: 0.1, 
    });

    return completion.choices[0].message.content || "TRIGGER_HANDOVER";
  } catch (error) {
    console.error("OpenAI Error:", error);
    return "TRIGGER_HANDOVER"; 
  }
}import OpenAI from 'openai';
import { LORABIZ_KNOWLEDGE_BASE } from './knowledge';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processTicketWithAI(ticketId: string, history: any[]) {
  const systemPrompt = {
    role: 'system',
    content: `You are Lora, the official support AI for LoraBiz. You operate in a strictly closed system.

KNOWLEDGE BASE:
"""
${LORABIZ_KNOWLEDGE_BASE}
"""

CRITICAL RULES:
1. CONVERSATIONAL & PERSONAL: Review the chat history for any "[System: Customer Onboarded]" messages. If you find the customer's Name and Service Topic, greet them by their specific name, acknowledge their chosen topic, and immediately provide a helpful response tailored to their issue. Continue to use their name naturally throughout the conversation.
2. HANDLING UNKNOWN QUERIES: If the user asks ANYTHING outside your strict knowledge, DO NOT invent answers. Instead, politely state that you do not have that information and ask them: "Would you like me to connect you with a support agent?"
3. EMPATHY & DE-ESCALATION: If the user expresses anger, worry, or frustration, apologize sincerely and console them professionally before addressing the issue.
4. THE HANDOVER TRIGGER: If the user EXPLICITLY asks for a human agent, OR if they say "yes" when you offer to connect them, you MUST reply with EXACTLY this phrase and nothing else: TRIGGER_HANDOVER
5. TONE: Maintain a professional, high-end corporate tone, but remain warm and welcoming.`
  };

  const mappedHistory = history.map((msg: any) => ({
    role: msg.senderType === 'CUSTOMER' ? 'user' : (msg.senderType === 'SYSTEM' ? 'system' : 'assistant'),
    content: msg.content
  }));

  const aiMessages = [systemPrompt, ...mappedHistory];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: aiMessages as any,
      temperature: 0.1, 
    });

    return completion.choices[0].message.content || "TRIGGER_HANDOVER";
  } catch (error) {
    console.error("OpenAI Error:", error);
    return "TRIGGER_HANDOVER"; 
  }
}
