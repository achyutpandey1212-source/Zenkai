import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "placeholder",
});

export function createOpenAIClient(baseURL?: string, apiKey?: string): OpenAI {
  return new OpenAI({
    baseURL: baseURL || "https://api.openai.com/v1",
    apiKey: apiKey || process.env.OPENAI_API_KEY || "placeholder",
  });
}

export { client as openaiClient };
