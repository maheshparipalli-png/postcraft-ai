import { geminiProvider } from "./gemini";
import { ollamaProvider } from "./ollama";
import type { AIProvider } from "./types";

const providers: Record<string, AIProvider> = {
  gemini: geminiProvider,
  ollama: ollamaProvider,
};

export function getAIProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "gemini";
  const provider = providers[name];

  if (!provider) {
    throw new Error(`Unsupported AI provider: ${name}`);
  }

  return provider;
}
