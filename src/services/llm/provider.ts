import { LLMProvider } from "./types";
import { GeminiProvider } from "./gemini.provider";

const provider: LLMProvider = (() => {
  const providerType = process.env.LLM_PROVIDER || "gemini";
  switch (providerType) {
    case "gemini":
      return new GeminiProvider();
    default:
      return new GeminiProvider();
  }
})();

export { provider };
