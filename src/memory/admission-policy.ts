import { GoogleGenAI } from "@google/genai";
import { MemoryCategory } from "@/models/Memory";

export interface AdmissionDecision {
  shouldStore: boolean;
  reason: string;
  category?: MemoryCategory;
  content?: string;
  summary?: string;
  confidence?: number;
  importance?: number;
  importanceReason?: string;
  keywords?: string[];
}

const ADMISSION_SYSTEM_PROMPT = `
You are the Memory Admission Policy Agent for Zenkai. Your job is to analyze a recent user message and the companion's response, and determine if any significant, enduring information about the user should be stored in their long-term memory.

Zenkai is a long-term growth partner, NOT a simple Q&A chatbot. We only store information that helps us understand the user's goals, behaviors, aspirations, values, constraints, and identity over weeks and months. We DO NOT store temporary, transient, trivial, or generic chat info.

Memory Category Taxonomy:
- 'Goal': Specific objectives they are working towards, e.g., "Finish my CS degree by December", "Run a 10k".
- 'Preference': Stable likes/dislikes, ways of doing things, e.g., "Prefers quiet study spaces", "Likes visual explanations".
- 'Habit': Routines, habits, patterns of action, e.g., "Exercises every morning", "Sleeps late on weekends".
- 'Constraint': Fixed limitations, rules, boundaries, e.g., "No meetings after 10pm", "Vegetarian diet only".
- 'Identity': Core self-definitions, e.g., "Is a software engineer", "Has ADHD".
- 'Project': Specific undertakings, e.g., "Building a mobile app for local gyms", "Writing a science fiction novel".
- 'Achievement': Notable accomplishments, milestones reached, e.g., "Passed the AWS certification exam", "Got promoted".
- 'Relationship': Important people or social connections, e.g., "Has a mentor named Sarah", "Works in a team of 5".
- 'Behavior': Stable personal tendencies or reactions, e.g., "Gets anxious when multitasking", "Speaks very directly".
- 'Motivation': Core drivers, reasons behind desires, e.g., "Wants to build things that reduce cognitive load".
- 'Knowledge': Acquired facts, skills, or domain expertise, e.g., "Knows Python and basic React", "Familiar with microservices".

Admission Rules:
1. Only store information that is specific to THIS user and is long-lasting/enduring.
2. Translate memories into 3rd person statements about the user. E.g., User says: "I work best at night" -> Content: "The user works best at night."
3. Assign an Importance score (0.0 to 10.0) and provide an explicit Importance Reason (e.g., "Explicit long-term career goal").

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
   * Deterministically evaluates message to filter out obvious non-memories.
   * Returns false if message is definitely not a memory candidate.
   */
  static isPotentialMemory(message: string): { isPotential: boolean; reason: string } {
    const text = message.trim().toLowerCase();
    
    if (text.length === 0) {
      return { isPotential: false, reason: "Empty message" };
    }

    // 1. Greetings
    const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "yo", "sup", "howdy", "greetings"];
    if (greetings.includes(text) || greetings.some(g => text.startsWith(g + " "))) {
      return { isPotential: false, reason: "Deterministic check: Greeting" };
    }

    // 2. Small Talk & Casual acknowledgements
    const smallTalk = [
      "ok", "okay", "yes", "no", "yep", "yup", "nah", "sure", "cool", "nice", "awesome", "great", 
      "thanks", "thank you", "thankyou", "fine", "correct", "wrong", "exactly", "indeed", "perfect",
      "no problem", "you're welcome", "haha", "hahaha", "lol", "interesting"
    ];
    if (smallTalk.includes(text) || text.length <= 4) {
      return { isPotential: false, reason: "Deterministic check: Small talk / casual acknowledgement" };
    }

    // 3. Factual questions / Programming questions (unless they have personal pronouns)
    const personalPronouns = ["i", "my", "me", "we", "our", "us", "myself"];
    const hasPersonalReference = personalPronouns.some(p => new RegExp(`\\b${p}\\b`).test(text));

    const queryStarters = ["what is", "how do", "how to", "why does", "explain", "tell me about", "who is", "where is", "solve"];
    const startsWithQuery = queryStarters.some(q => text.startsWith(q));

    if (startsWithQuery && !hasPersonalReference) {
      return { isPotential: false, reason: "Deterministic check: Generic Q&A / Factual query" };
    }

    // 4. Coding snippets / Math syntax checks
    const mathCodeTriggers = ["const ", "let ", "var ", "function", "import ", "export ", "class ", "===", "++", "=>", " + ", " = ", " * "];
    const isMathOrCode = mathCodeTriggers.some(trigger => text.includes(trigger)) || /^[0-9+\-*/= ]+$/.test(text);
    if (isMathOrCode && !hasPersonalReference) {
      return { isPotential: false, reason: "Deterministic check: Code snippet or mathematical expression" };
    }

    return { isPotential: true, reason: "Uncertain (needs LLM validation)" };
  }

  /**
   * Evaluates a user message and assistant response to decide if a memory should be admitted.
   */
  static async evaluateExchange(
    userMessage: string,
    assistantResponse: string
  ): Promise<AdmissionDecision> {
    // 1. Run deterministic checks first
    const check = this.isPotentialMemory(userMessage);
    if (!check.isPotential) {
      console.log(`[AdmissionPolicy] ${check.reason}`);
      return { shouldStore: false, reason: check.reason };
    }

    // 2. Call Gemini only if deterministic checks are uncertain
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
              category: {
                type: "STRING",
                enum: [
                  "Goal",
                  "Preference",
                  "Habit",
                  "Constraint",
                  "Identity",
                  "Project",
                  "Achievement",
                  "Relationship",
                  "Behavior",
                  "Motivation",
                  "Knowledge"
                ]
              },
              content: { type: "STRING" },
              summary: { type: "STRING" },
              confidence: { type: "NUMBER" },
              importance: { type: "NUMBER" },
              importanceReason: { type: "STRING" },
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
