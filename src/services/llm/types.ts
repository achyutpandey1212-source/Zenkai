export interface LLMRequest {
  prompt?: string;
  systemInstruction?: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: any;
  contents?: any;
}

export interface LLMResponse {
  text?: string;
  candidates?: any[];
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface LLMStreamChunk {
  text?: string;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export interface LLMProvider {
  generate(request: LLMRequest): Promise<LLMResponse>;
  generateStream(request: LLMRequest): Promise<AsyncIterable<LLMStreamChunk>>;
}
