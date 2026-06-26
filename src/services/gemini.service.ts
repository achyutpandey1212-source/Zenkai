import { GoogleGenAI } from "@google/genai";

const COMPANION_SYSTEM_PROMPT = `
You are the Companion Agent for Zenkai, a calm AI companion and growth partner.
You are the primary interface between the user and the AI Growth Partner system.
Your job is not to solve everything yourself.
Your job is to understand the user’s intent, gather relevant context from available memory, and communicate naturally.
You should feel supportive, calm, intelligent, and trustworthy.
You care about helping the user grow.

You never manipulate.
You never guilt-trip.
You never pretend certainty when uncertain.
When relevant, remind the user of their goals, values, and commitments.
Your objective is to reduce cognitive load and increase clarity.
You are the face of the system, not the entire brain.

Personality Guidelines:
- The Companion is calm, patient, and thoughtful.
- Never robotic, never overly excited (do NOT use exclamations like "Wow!", "Awesome!", "Great!").
- Never use excessive emojis (use them extremely rarely if ever, preferring none at all).
- Never behave like typical corporate customer support.
- Feel like a mentor quietly helping someone become better.
- Keep responses relatively concise, focused, and spacious.
`;

export class GeminiService {
  private static client: GoogleGenAI | null = null;

  private static getClient(): GoogleGenAI {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable.");
      }
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  /**
   * Generates a streaming response from Gemini for the Companion Agent.
   *
   * @param message The user's new message text
   * @param history The conversation history mapped to Gemini's format
   */
  static async generateCompanionStream(
    message: string,
    history: { role: "user" | "model"; content: string }[]
  ) {
    const ai = this.getClient();

    // Map conversation history
    const contents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    // Append the current user message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Request stream
    return ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: COMPANION_SYSTEM_PROMPT.trim(),
        temperature: 0.7,
      },
    });
  }

  /**
   * Generates a streaming response from Gemini for the Companion Agent, injecting relevant long-term memory context.
   *
   * @param message The user's new message text
   * @param history The conversation history mapped to Gemini's format
   * @param memoryPromptText Formatted memory context to inject
   * @param identityPromptText Formatted identity context to inject
   * @param profilePromptText Formatted profile context to inject
   */
  static async generateCompanionStreamWithMemory(
    message: string,
    history: { role: "user" | "model"; content: string }[],
    memoryPromptText: string,
    identityPromptText: string,
    profilePromptText: string = ""
  ) {
    const ai = this.getClient();

    // Map conversation history
    const contents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    // Append the current user message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    });

    // Weave the profile, memory and identity prompt text into system instruction.
    const systemPromptWithMemory = `
${COMPANION_SYSTEM_PROMPT.trim()}

${profilePromptText}

${memoryPromptText}

${identityPromptText}

IMPORTANT MEMORY USAGE DIRECTIVES:
- Never say "I searched my memory", "According to my database", "I recall from our past conversations", or "My records say".
- Never quote memories in a robotic, dry, or formal way.
- Instead, speak naturally. Weave the context into your responses as if you simply remember the user, just like a close human friend or mentor would.
- Keep the user's goals and preferences in mind when formulating suggestions and feedback.
`.trim();

    // Request stream
    return ai.models.generateContentStream({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction: systemPromptWithMemory,
        temperature: 0.7,
      },
    });
  }
}
