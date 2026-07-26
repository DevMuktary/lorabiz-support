import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function processTicketWithAI(ticketId: string, history: any[]) {
  const systemPrompt = {
    role: 'system',
    content: `You are Lora, the official support bot for LoraBiz.
CRITICAL RULES:
1. You ONLY answer basic questions about LoraBiz services (Business Name Registration, LLC, Tax compliance).
2. NEVER search the internet, give generic advice, or invent answers. You are a closed system.
3. If the user asks ANYTHING outside your strict knowledge, or if you don't know the exact answer, you MUST reply with exactly this phrase and nothing else: TRIGGER_HANDOVER
4. Keep answers short and professional.`
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