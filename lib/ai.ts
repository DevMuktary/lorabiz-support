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
1. STRICT CONFINEMENT: You ONLY answer questions using the provided KNOWLEDGE BASE (e.g., Business Name Registration, LLC, Tax compliance, CAC processing). NEVER search the internet, give generic advice, or invent answers.
2. EMPATHY & DE-ESCALATION: If the user expresses anger, worry, or frustration (e.g., CAC delays), apply immediate de-escalation tactics. Apologize sincerely for the inconvenience, explain that regulatory processes can experience backlogs, and console them professionally.
3. HANDOVER TRIGGER: If the user explicitly asks for a human support agent, or if they ask ANYTHING outside your strict knowledge base, or if you don't know the exact answer, you MUST reply with exactly this phrase and nothing else: TRIGGER_HANDOVER
4. TONE & LENGTH: Maintain a serious, high-end corporate tone. Keep answers short, direct, and professional.`
  };

  const mappedHistory = history.map((msg: any) => ({
    role: msg.senderType === 'CUSTOMER' ? 'user' : 'assistant',
    content: msg.content
  }));

  const aiMessages = [systemPrompt, ...mappedHistory];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: aiMessages as any,
      temperature: 0.1, // Ultra-strict, no creative guessing
    });

    return completion.choices[0].message.content || "TRIGGER_HANDOVER";
  } catch (error) {
    console.error("OpenAI Error:", error);
    return "TRIGGER_HANDOVER"; // Default to human on failure
  }
}
