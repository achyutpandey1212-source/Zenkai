/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from "@google/genai";
import { telemetryStorage, GlobalTelemetryTracker } from "@/lib/telemetry-context";
import type { LLMStreamChunk } from "./types";

function formatContents(contents: any): string {
  if (!contents) return "";
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents
      .map((c: any) => {
        const role = c.role ?? "user";
        const text = c.parts
          ?.map((p: any) => {
            if (typeof p === "string") return p;
            if (p && typeof p === "object" && "text" in p) return p.text;
            return "";
          })
          .join("") ?? "";
        return `${role}: ${text}`;
      })
      .join("\n");
  }
  return JSON.stringify(contents);
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const PRICING: Record<string, { input: number; output: number }> = {
    "gemini-2.5-flash": { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
    "gemini-2.5-pro": { input: 3.50 / 1_000_000, output: 10.50 / 1_000_000 },
    default: { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  };
  const rate = PRICING[model] || PRICING.default;
  return promptTokens * rate.input + completionTokens * rate.output;
}

function recordAICall(params: any, result: any, duration: number, error: any) {
  const store = telemetryStorage.getStore();
  if (!store) return;

  const model = params?.model ?? "gemini-2.5-flash";
  const prompt = formatContents(params?.contents ?? params?.prompt);
  const usage = result?.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const completionTokens = usage?.candidatesTokenCount ?? 0;
  const totalTokens = usage?.totalTokenCount ?? 0;
  const cost = estimateCost(model, promptTokens, completionTokens);

  const state = store.stateRef as any;

  const aiCall = {
    model,
    prompt,
    systemInstruction: "",
    responseMimeType: params?.responseMimeType,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
    duration,
    success: !error,
    error: error ? error.message : undefined,
    timestamp: new Date().toISOString(),
    retrievedMemories: state?.memoryPromptText || "",
    identityContext: state?.identityPromptText || "",
    reflectionContext: state?.reflectionPromptText || "",
  };

  store.aiCalls.push(aiCall);
  if (state) {
    state.aiCalls = [...store.aiCalls];
  }
}

async function* wrapStream(
  originalStream: AsyncIterable<any>,
  params: any,
  startTime: number
) {
  let lastUsageMetadata: any = null;
  let text = "";
  try {
    for await (const chunk of originalStream) {
      if (chunk.usageMetadata) {
        lastUsageMetadata = chunk.usageMetadata;
      }
      if (chunk.text) {
        text += chunk.text;
      }
      yield chunk;
    }
    const duration = Date.now() - startTime;
    const mockResult = {
      candidates: [{ content: { parts: [{ text }], role: "model" } }],
      usageMetadata: lastUsageMetadata,
    };
    recordAICall(params, mockResult, duration, null);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    recordAICall(params, null, duration, error);
    throw error;
  }
}

export class GeminiProvider {
  private static client: GoogleGenAI | null = null;
  private model: string;

  constructor() {
    const model = process.env.LLM_MODEL || "gemini-2.5-flash";
    this.model = model;
    if (!GeminiProvider.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Missing GEMINI_API_KEY environment variable.");
      }
      GeminiProvider.client = new GoogleGenAI({ apiKey });
    }
  }

  async generate(request: any): Promise<any> {
    const {
      prompt,
      systemInstruction,
      temperature = 0.1,
      maxOutputTokens,
      responseMimeType,
      responseSchema,
      contents,
    } = request;
    const model = request.model || this.model;

    GlobalTelemetryTracker.recordCall();
    const startTime = Date.now();

    try {
      const result = await this.generateContents({
        model,
        contents: contents || [{ role: "user", parts: [{ text: prompt || "" }] }],
        systemInstruction,
        temperature,
        maxOutputTokens,
        responseMimeType,
        responseSchema,
      });

      const duration = Date.now() - startTime;
      const resultText = result.text;
      recordAICall(
        { model, prompt: prompt || "", responseMimeType, contents },
        result,
        duration,
        null
      );

      if (!resultText) {
        return { text: undefined };
      }

      return {
        text: resultText,
        candidates: result.candidates,
        usageMetadata: result.usageMetadata,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      recordAICall(
        { model, prompt: prompt || "", responseMimeType, contents },
        null,
        duration,
        error
      );
      throw error;
    }
  }

  async generateStream(request: any): Promise<AsyncIterable<LLMStreamChunk>> {
    const {
      prompt,
      systemInstruction,
      temperature = 0.7,
      maxOutputTokens,
      contents,
    } = request;

    const model = request.model || this.model;
    const chatHistory =
      contents || [{ role: "user", parts: [{ text: prompt || "" }] }];

    GlobalTelemetryTracker.recordCall();
    const startTime = Date.now();

    const stream = await this.generateStreamContents({
      model,
      contents: chatHistory,
      systemInstruction,
      temperature,
      maxOutputTokens,
    });

    const params = {
      model,
      prompt: prompt || "",
      contents: chatHistory,
    };

    return wrapStream(stream, params, startTime) as AsyncIterable<LLMStreamChunk>;
  }

  private async generateContents(options: any): Promise<any> {
    let attempt = 0;
    const maxRetries = 3;
    const initialDelayMs = 2500;

    while (true) {
      try {
        return await GeminiProvider.client!.models.generateContent({
          model: options.model,
          contents: options.contents,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
            responseMimeType: options.responseMimeType,
            responseSchema: options.responseSchema,
          },
        });
      } catch (error: any) {
        attempt++;
        const errorMessage = error.message || "";
        const status = error.status || error.statusCode || 0;

        const isQuotaExhausted =
          status === 429 &&
          (errorMessage.includes("RESOURCE_EXHAUSTED") ||
            errorMessage.includes("quota") ||
            errorMessage.includes("limit") ||
            errorMessage.includes("generate_content_free_tier_requests") ||
            errorMessage.includes("GenerateRequestsPerDayPerProjectPerModel-FreeTier"));

        if (isQuotaExhausted) {
          const store = telemetryStorage.getStore();
          const stateRef = store?.stateRef as any;
          if (stateRef) {
            if (!stateRef.retries) stateRef.retries = [];
            stateRef.retries.push({ action: "geminiCall", attempt, error: errorMessage });
          }
          console.warn(`[Gemini] Hard quota exhausted. Skipping retries. Reason: ${errorMessage}`);
          throw error;
        }

        const isTransient =
          status === 429 ||
          status === 403 ||
          status >= 500 ||
          errorMessage.includes("429") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("ETIMEDOUT") ||
          errorMessage.includes("fetch failed") ||
          errorMessage.includes("DNS");

        if (isTransient && attempt <= maxRetries) {
          const store = telemetryStorage.getStore();
          const stateRef = store?.stateRef as any;
          if (stateRef) {
            if (!stateRef.retries) stateRef.retries = [];
            stateRef.retries.push({ action: "geminiCall", attempt, error: errorMessage });
          }
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          console.warn(
            `[Gemini] Transient error (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... Reason: ${errorMessage}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }

  private async generateStreamContents(options: any): Promise<AsyncIterable<any>> {
    let attempt = 0;
    const maxRetries = 3;
    const initialDelayMs = 2500;

    while (true) {
      try {
        return await GeminiProvider.client!.models.generateContentStream({
          model: options.model,
          contents: options.contents,
          config: {
            systemInstruction: options.systemInstruction,
            temperature: options.temperature,
            maxOutputTokens: options.maxOutputTokens,
          },
        });
      } catch (error: any) {
        attempt++;
        const errorMessage = error.message || "";
        const status = error.status || error.statusCode || 0;

        const isQuotaExhausted =
          status === 429 &&
          (errorMessage.includes("RESOURCE_EXHAUSTED") ||
            errorMessage.includes("quota") ||
            errorMessage.includes("limit") ||
            errorMessage.includes("generate_content_free_tier_requests") ||
            errorMessage.includes("GenerateRequestsPerDayPerProjectPerModel-FreeTier"));

        if (isQuotaExhausted) {
          const store = telemetryStorage.getStore();
          const stateRef = store?.stateRef as any;
          if (stateRef) {
            if (!stateRef.retries) stateRef.retries = [];
            stateRef.retries.push({ action: "geminiCall", attempt, error: errorMessage });
          }
          console.warn(`[Gemini] Hard quota exhausted. Skipping retries. Reason: ${errorMessage}`);
          throw error;
        }

        const isTransient =
          status === 429 ||
          status === 403 ||
          status >= 500 ||
          errorMessage.includes("429") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("ETIMEDOUT") ||
          errorMessage.includes("fetch failed") ||
          errorMessage.includes("DNS");

        if (isTransient && attempt <= maxRetries) {
          const store = telemetryStorage.getStore();
          const stateRef = store?.stateRef as any;
          if (stateRef) {
            if (!stateRef.retries) stateRef.retries = [];
            stateRef.retries.push({ action: "geminiCall", attempt, error: errorMessage });
          }
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          console.warn(
            `[Gemini] Transient error (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... Reason: ${errorMessage}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  }
}
