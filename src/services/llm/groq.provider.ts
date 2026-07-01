/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import { telemetryStorage, GlobalTelemetryTracker } from "@/lib/telemetry-context";
import type { LLMResponse, LLMStreamChunk } from "./types";
import { buildOpenAIMessages } from "./openai-utils";

async function* streamChatCompletion(
  stream: any,
  params: any,
  startTime: number,
  accumulate: boolean = true
): AsyncIterable<LLMStreamChunk> {
  let accumulatedText = "";
  let promptTokens = 0;
  let completionTokens = 0;

  try {
    for await (const chunk of stream) {
      if (chunk.usage) {
        promptTokens = chunk.usage.prompt_tokens || 0;
        completionTokens = chunk.usage.completion_tokens || 0;
      }
      const delta = chunk.choices[0]?.delta?.content || "";
      if (accumulate) accumulatedText += delta;
      yield {
        text: delta,
        usageMetadata: {
          promptTokenCount: promptTokens || undefined,
          candidatesTokenCount: completionTokens || undefined,
          totalTokenCount: (promptTokens + completionTokens) || undefined,
        },
      };
    }

    const duration = Date.now() - startTime;
    recordAICall(
      { model: params.model, prompt: params.prompt, systemInstruction: params.systemInstruction },
      {
        choices: [{ message: { content: accumulate ? accumulatedText : undefined } }],
        usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: promptTokens + completionTokens },
      },
      duration,
      null
    );
  } catch (error: any) {
    const duration = Date.now() - startTime;
    recordAICall(params, null, duration, error);
    throw error;
  }
}

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const PRICING: Record<string, { input: number; output: number }> = {
    "llama-3.1-8b-instant": { input: 0.05 / 1_000_000, output: 0.08 / 1_000_000 },
    "llama-3.1-70b-versatile": { input: 0.59 / 1_000_000, output: 0.79 / 1_000_000 },
    "mixtral-8x7b-32768": { input: 0.24 / 1_000_000, output: 0.24 / 1_000_000 },
    "gemma2-9b-it": { input: 0.20 / 1_000_000, output: 0.20 / 1_000_000 },
    default: { input: 0.05 / 1_000_000, output: 0.08 / 1_000_000 },
  };
  const rate = PRICING[model] || PRICING.default;
  return promptTokens * rate.input + completionTokens * rate.output;
}

function recordAICall(params: any, result: any, duration: number, error: any) {
  const store = telemetryStorage.getStore();
  if (!store) return;

  const model = params?.model || "default";
  const prompt = typeof params?.prompt === "string"
    ? params.prompt
    : Array.isArray(params?.contents)
      ? JSON.stringify(params.contents)
      : "";
  const usage = result?.usage;
  const promptTokens = usage?.prompt_tokens ?? 0;
  const completionTokens = usage?.completion_tokens ?? 0;
  const totalTokens = usage?.total_tokens ?? 0;
  const cost = estimateCost(model, promptTokens, completionTokens);

  const state = store.stateRef as any;

  const aiCall = {
    model,
    prompt,
    systemInstruction: params?.systemInstruction || "",
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

export class GroqProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GROQ_API_KEY environment variable.");
    }
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
    this.model = process.env.LLM_MODEL || "llama-3.1-8b-instant";
  }

  async generate(request: any): Promise<LLMResponse> {
    const { temperature = 0.1, maxOutputTokens, responseMimeType, responseSchema } = request;
    const model = request.model || this.model;
    const messages = buildOpenAIMessages(request);

    GlobalTelemetryTracker.recordCall();
    const startTime = Date.now();

    let attempt = 0;
    const maxRetries = 3;
    const initialDelayMs = 2500;

    while (true) {
      try {
        const params: any = {
          model,
          messages,
          temperature,
          max_tokens: maxOutputTokens || 8192,
        };

        if (responseMimeType === "application/json" || responseSchema) {
          params.response_format = { type: "json_object" };
          params.messages = [
            { role: "system", content: "You must respond with valid JSON only. No markdown, no explanations, just raw JSON." },
            ...messages.filter((m: any) => m.role !== "system"),
          ];
        }

        const completion = await this.client.chat.completions.create(params);
        const duration = Date.now() - startTime;
        const text = completion.choices[0]?.message?.content || "";

        recordAICall(
          { model, prompt: JSON.stringify(messages), systemInstruction: request.systemInstruction, responseMimeType },
          completion,
          duration,
          null
        );

        return {
          text,
          candidates: completion.choices,
          usageMetadata: {
            promptTokenCount: completion.usage?.prompt_tokens,
            candidatesTokenCount: completion.usage?.completion_tokens,
            totalTokenCount: completion.usage?.total_tokens,
          },
        };
      } catch (error: any) {
        attempt++;
        const errorMessage = error.message || "";
        const isRetryable =
          errorMessage.includes("rate_limit") ||
          errorMessage.includes("429") ||
          errorMessage.includes("503") ||
          error.status === 429 ||
          error.status === 503;

        if (isRetryable && attempt <= maxRetries) {
          const delay = initialDelayMs * Math.pow(2, attempt - 1);
          console.warn(
            `[Groq] Retryable error (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms... Reason: ${errorMessage}`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }
        const duration = Date.now() - startTime;
        recordAICall(
          { model, prompt: JSON.stringify(messages), systemInstruction: request.systemInstruction, responseMimeType },
          null,
          duration,
          error
        );
        throw error;
      }
    }
  }

  async generateStream(request: any): Promise<AsyncIterable<LLMStreamChunk>> {
    const { temperature = 0.7, maxOutputTokens } = request;
    const model = request.model || this.model;
    const messages = buildOpenAIMessages(request);

    GlobalTelemetryTracker.recordCall();
    const startTime = Date.now();

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxOutputTokens || 8192,
      stream: true,
    });

    const params = {
      model,
      prompt: JSON.stringify(messages),
      systemInstruction: request.systemInstruction,
    };

    return streamChatCompletion(stream, params, startTime);
  }
}
