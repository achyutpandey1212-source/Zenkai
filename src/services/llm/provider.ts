import { LLMProvider } from "./types";
import { GeminiProvider } from "./gemini.provider";
import { GroqProvider } from "./groq.provider";
import { MistralProvider } from "./mistral.provider";
import { OpenRouterProvider } from "./openrouter.provider";
import { OllamaProvider } from "./ollama.provider";

const provider: LLMProvider = (() => {
  const providerType = process.env.LLM_PROVIDER || "gemini";
  switch (providerType) {
    case "gemini":
      return new GeminiProvider();
    case "groq":
      return new GroqProvider();
    case "mistral":
      return new MistralProvider();
    case "openrouter":
      return new OpenRouterProvider();
    case "ollama":
      return new OllamaProvider();
    default:
      console.warn(`[LLM] Unknown provider "${providerType}", defaulting to Gemini.`);
      return new GeminiProvider();
  }
})();

export { provider };
