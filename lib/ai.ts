import OpenAI from 'openai';
import { databases } from '@/lib/appwrite';

// Initialize OpenAI (You can swap the baseURL for DeepSeek if you prefer)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, 
  // baseURL: "https://api.deepseek.com/v1", // Uncomment if using DeepSeek
});

const dbId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const ticketsCol = process.env.NEXT_PUBLIC_APPWRITE_TICKETS_COLLECTION_ID!;

export async function processTicketWithAI(ticketId: string, conversationHistory: any[]) {
  try {
    // Format history for the AI
    const aiMessages = conversationHistory.map(msg => ({
      role: msg.senderType === 'CUSTOMER' ? 'user' : 'assistant',
      content: msg.content
    }));

    // Add the System Prompt (The Rules for the AI)
    aiMessages.unshift({
      role: 'system',
      content: `You are the LoraBiz Support Assistant. Your job is to help users with basic queries. 
      If the user is asking something complex, asking about payments, or seems angry, you MUST reply with EXACTLY this phrase: 
      "ESCALATE_TO_HUMAN". Do not say anything else. 
      If you can help them, provide a friendly, helpful response.`
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // or deepseek-chat
      messages: aiMessages as any, // <--- ADD "as any" HERE
      temperature: 0.3,
    });

    const aiResponse = completion.choices[0].message.content || '';

    // Check if the AI decided to escalate
    if (aiResponse.includes('ESCALATE_TO_HUMAN')) {
      // Update ticket to need a human
      await databases.updateDocument(dbId, ticketsCol, ticketId, {
        status: 'PENDING_AGENT',
        lastMessage: 'Agent requested by AI.'
      });
      return "I'm connecting you with a human agent who can help you better. Please hold on a moment.";
    }

    // Otherwise, return the AI's actual answer
    return aiResponse;

  } catch (error) {
    console.error("AI Processing Error:", error);
    return "I'm having a little trouble thinking right now. Let me connect you to a human agent.";
  }
}