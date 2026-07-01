/* eslint-disable @typescript-eslint/no-explicit-any */
import OpenAI from "openai";
import { telemetryStorage, GlobalTelemetryTracker } from "@/lib/telemetry-context";
import type { LLMResponse, LLMStreamChunk } from "./types";

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

  const state = store.stateRef as any;

  const aiCall = {
    model,
    prompt,
    systemInstruction: params?.systemInstruction || "",
    responseMimeType: params?.responseMimeType,
    promptTokens,
    completionTokens,
    totalTokens,
    cost: 0,
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

function buildContents(request: any): any[] {
  if (request.contents) return request.contents;
  const messages: any[] = [];
  if (request.systemInstruction) {
    messages.push({ role: "system", content: request.systemInstruction });
  }
  if (request.prompt) {
    messages.push({ role: "user", content: request.prompt });
  }
  return messages;
}

export class OllamaProvider {
  private client: OpenAI;
  private model: string;

  constructor() {
    const apiKey = process.env.OLLAMA_API_KEY || "ollama";
    const baseURL = process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1";

    this.client = new OpenAI({
      apiKey,
      baseURL,
    });
    this.model = process.env.LLM_MODEL || "llama3.1";
  }

  async generate(request: any): Promise<LLMResponse> {
    const { temperature = 0.1, maxOutputTokens, responseMimeType, responseSchema } = request;
    const model = request.model || this.model;
    let messages = buildContents(request);

    GlobalTelemetryTracker.recordCall();
    const startTime = Date.now();

    const needsJson = responseMimeType === "application/json" || !!responseSchema;
    if (needsJson) {
      messages = [
        { role: "system", content: "CRITICAL: You must respond with ONLY valid raw JSON. No markdown code blocks, no backticks, no ```json, no explanations, no preamble, no trailing text. Just the raw JSON object starting with { and ending with }. If you cannot comply, respond with an empty JSON object {}." },
        ...messages,
      ];
    }

    try {
      const params: any = {
        model,
        messages,
        temperature,
        max_tokens: maxOutputTokens || 4096,
        stream: false,
      };

      const completion = await this.client.chat.completions.create(params);
      const duration = Date.now() - startTime;
      let text = completion.choices[0]?.message?.content || "";

      if (needsJson) {
        text = this.extractJson(text);
      }

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

  async generateStream(request: any): Promise<AsyncIterable<LLMStreamChunk>> {
    const { temperature = 0.7, maxOutputTokens, responseMimeType, responseSchema } = request;
    const model = request.model || this.model;
    let messages = buildContents(request);

    GlobalTelemetryTracker.recordCall();
    const startTime = Date.now();

    const needsJson = responseMimeType === "application/json" || !!responseSchema;
    if (needsJson) {
      messages = [
        { role: "system", content: "CRITICAL: Your entire response must be ONLY valid raw JSON. No markdown, no code blocks, no explanations. Start with { and end with }." },
        ...messages,
      ];
    }

    const stream = await this.client.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxOutputTokens || 4096,
      stream: true,
    });

    const params = {
      model,
      prompt: JSON.stringify(messages),
      systemInstruction: request.systemInstruction,
    };

    return streamChatCompletion(stream, params, startTime);
  }

  private extractJson(text: string): string {
    if (!text) return "{}";
    const trimmed = text.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try { JSON.parse(trimmed); return trimmed; } catch {}
    }
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = trimmed.substring(firstBrace, lastBrace + 1);
      try { JSON.parse(candidate); return candidate; } catch {}
    }
    return "{}";
  }
}
