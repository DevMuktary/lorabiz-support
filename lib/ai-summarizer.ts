import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const SUMMARIZATION_PROMPT = `
You are a backend summarization utility for LoraBiz support agents. 
Your task is to review the provided chat transcript between a user and the Lora AI support assistant. 

Generate a concise, highly structured, bulleted brief containing:
1. The user's core issue or request.
2. The user's current emotional state (e.g., frustrated, neutral, confused).
3. Any specific data points the user provided (e.g., tracking numbers, dates, account details).

Do not include any pleasantries, conversational filler, or introductory phrases in your output. Output only the requested bulleted brief so the human agent can take over the ticket immediately with full context.
`;

export async function summarizeChatForAgent(chatTranscript: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: 'system', content: SUMMARIZATION_PROMPT },
        { role: 'user', content: `Chat Transcript:\n${chatTranscript}` }
      ],
      temperature: 0.2,
    });

    return completion.choices[0].message.content || "Unable to generate summary.";
  } catch (error) {
    console.error("OpenAI Summarizer Error:", error);
    return "Failed to generate AI summary due to an error.";
  }
}
