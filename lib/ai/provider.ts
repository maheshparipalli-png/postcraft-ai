import { ollamaProvider } from "./ollama";
import { geminiProvider } from "./gemini";
import type { AIProvider } from "./types";

const providers: Record<string, AIProvider> = {
  ollama: ollamaProvider,
  gemini: geminiProvider,
};

export function getAIProvider(): AIProvider {
  // Ollama is the default provider for local development.
  // Gemini is available only when explicitly selected with AI_PROVIDER=gemini.
  const name = process.env.AI_PROVIDER ?? "ollama";
  const provider = providers[name];

  if (!provider) {
    throw new Error(`Unsupported AI provider: ${name}`);
  }

  return provider;
}
