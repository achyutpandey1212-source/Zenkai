/* eslint-disable @typescript-eslint/no-explicit-any */
import { GoogleGenAI } from "@google/genai";
import { telemetryStorage, GlobalTelemetryTracker } from "./telemetry-context";

// Pricing rates: cost per token for gemini-2.5-flash
const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": {
    input: 0.075 / 1_000_000,
    output: 0.30 / 1_000_000,
  },
  "default": {
    input: 0.075 / 1_000_000,
    output: 0.30 / 1_000_000,
  }
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rate = PRICING[model] || PRICING["default"];
  return (promptTokens * rate.input) + (completionTokens * rate.output);
}

function formatContents(contents: any): string {
  if (!contents) return "";
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) {
    return contents.map((c: any) => {
      const role = c.role ?? "user";
      const text = c.parts?.map((p: any) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object" && "text" in p) return p.text;
        return "";
      }).join("") ?? "";
      return `${role}: ${text}`;
    }).join("\n");
  }
  return JSON.stringify(contents);
}

function recordAICall(params: any, result: any, duration: number, error: any) {
  const store = telemetryStorage.getStore();
  if (!store) return;

  const model = params?.model ?? "gemini-2.5-flash";
  const prompt = formatContents(params?.contents);
  const systemInstruction = params?.config?.systemInstruction ?? "";
  
  // Extract usage metadata
  const usage = result?.usageMetadata;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const completionTokens = usage?.candidatesTokenCount ?? 0;
  const totalTokens = usage?.totalTokenCount ?? 0;
  const cost = estimateCost(model, promptTokens, completionTokens);

  const state = store.stateRef as any;

  const aiCall = {
    model,
    prompt,
    systemInstruction,
    responseMimeType: params?.config?.responseMimeType,
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

  // Sync back to state immediately if state is active
  if (state) {
    state.aiCalls = [...store.aiCalls];
  }
}

// Wrap the async stream generator
async function* wrapStream(originalStream: any, params: any, startTime: number) {
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
      candidates: [{
        content: {
          parts: [{ text }],
          role: "model"
        }
      }],
      usageMetadata: lastUsageMetadata
    };
    recordAICall(params, mockResult, duration, null);
  } catch (error: any) {
    const duration = Date.now() - startTime;
    recordAICall(params, null, duration, error);
    throw error;
  }
}

// Global hook using prototype getter/setter to bypass ES module freezing
Object.defineProperty(GoogleGenAI.prototype, "models", {
  get() {
    return this._trackedModels;
  },
  set(val) {
    if (val) {
      const originalGenerateContent = val.generateContent;
      val.generateContent = async function (params: any) {
        GlobalTelemetryTracker.recordCall();
        const startTime = Date.now();
        try {
          const result = await originalGenerateContent.call(val, params);
          const duration = Date.now() - startTime;
          recordAICall(params, result, duration, null);
          return result;
        } catch (error: any) {
          const duration = Date.now() - startTime;
          recordAICall(params, null, duration, error);
          throw error;
        }
      };

      const originalGenerateContentStream = val.generateContentStream;
      val.generateContentStream = async function (params: any) {
        GlobalTelemetryTracker.recordCall();
        const startTime = Date.now();
        try {
          const stream = await originalGenerateContentStream.call(val, params);
          return wrapStream(stream, params, startTime);
        } catch (error: any) {
          const duration = Date.now() - startTime;
          recordAICall(params, null, duration, error);
          throw error;
        }
      };
    }
    this._trackedModels = val;
  },
  configurable: true,
  enumerable: true
});
