import { GoogleGenAI } from "@google/genai";
import { MemoryType } from "@/models/Memory";

export interface AdmissionDecision {
  shouldStore: boolean;
  reason: string;
  memoryType?: MemoryType;
  content?: string;
  summary?: string;
  confidence?: number;
  importance?: number;
  keywords?: string[];
}

const ADMISSION_SYSTEM_PROMPT = `
You are the Memory Admission Policy Agent for Zenkai. Your job is to analyze a recent user message and the companion's response, and determine if any significant, enduring information about the user should be stored in their long-term memory.

Zenkai is a long-term growth partner, NOT a simple Q&A chatbot. We only store information that helps us understand the user's goals, behaviors, aspirations, values, constraints, and identity over weeks and months. We DO NOT store temporary, transient, trivial, or generic chat info.

Memory Type Taxonomy:
- 'identity': Core self-definitions, e.g., "I am a visual learner", "I have ADHD".
- 'aspiration': Long-term desires, vision, who they want to become, e.g., "I want to become an entrepreneur".
- 'principle': Core values and beliefs guiding actions, e.g., "Family comes first", "Honesty is crucial".
- 'behavior': Routines, habits, patterns of action, e.g., "I work best late at night", "I get distracted after lunch".
- 'constraint': Fixed limitations, rules, boundaries, e.g., "No meetings after 10pm", "Vegetarian diet only".
- 'pattern': Recurring themes or issues, e.g., "Tendency to overcommit", "Losing motivation in week 3".
- 'goal': Specific objectives they are working towards, e.g., "Finish my CS degree by December", "Run a 10k".
- 'reflection': Deep self-realizations, lessons learned, e.g., "I realized I care more about autonomy than money".

Admission Rules:
1. Only store information that is:
   - Specific to THIS user.
   - Long-lasting/enduring (not temporary states like "I am hungry right now").
   - Actionable or useful for a growth companion to support them.
2. Reject:
   - Simple greetings or polite remarks ("Hi", "Thanks").
   - One-off factual queries, mathematical/programming help ("How to use git", "2+2").
   - Short-term states ("I am tired today", "I had pizza for lunch").
   - General trivia or opinions on non-personal matters.
3. Be conservative. It is better to store nothing than to clutter the memory with junk.
4. Translate memories into 3rd person statements about the user. E.g., User says: "I work best at night" -> Content: "The user works best at night."

You must return a JSON response matching the requested schema.
`;

export class AdmissionPolicy {
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
   * Evaluates a user message and assistant response to decide if a memory should be admitted.
   */
  static async evaluateExchange(
    userMessage: string,
    assistantResponse: string
  ): Promise<AdmissionDecision> {
    const ai = this.getClient();

    const userPrompt = `
Analyze this conversation exchange:
User Message: "${userMessage.replace(/"/g, '\\"')}"
Companion Response: "${assistantResponse.replace(/"/g, '\\"')}"

Determine if any long-term memory should be stored. Return JSON only.
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          { role: "user", parts: [{ text: userPrompt }] }
        ],
        config: {
          systemInstruction: ADMISSION_SYSTEM_PROMPT.trim(),
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              shouldStore: { type: "BOOLEAN" },
              reason: { type: "STRING" },
              memoryType: {
                type: "STRING",
                enum: [
                  "identity",
                  "aspiration",
                  "principle",
                  "behavior",
                  "constraint",
                  "pattern",
                  "goal",
                  "reflection"
                ]
              },
              content: { type: "STRING" },
              summary: { type: "STRING" },
              confidence: { type: "NUMBER" },
              importance: { type: "NUMBER" },
              keywords: {
                type: "ARRAY",
                items: { type: "STRING" }
              }
            },
            required: ["shouldStore", "reason"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        return { shouldStore: false, reason: "No response from Gemini API" };
      }

      const decision = JSON.parse(responseText) as AdmissionDecision;
      
      // Clean and normalize keywords
      if (decision.shouldStore && decision.keywords) {
        decision.keywords = decision.keywords.map(kw => kw.toLowerCase().trim()).filter(Boolean);
      }

      return decision;
    } catch (error) {
      console.error("Error evaluating exchange in AdmissionPolicy:", error);
      return {
        shouldStore: false,
        reason: `Error during evaluation: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}
