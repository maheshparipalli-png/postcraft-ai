import { ollamaProvider } from "./ollama";
import type { AIProvider } from "./types";

const providers: Record<string, AIProvider> = {
  ollama: ollamaProvider,
};

export function getAIProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "ollama";
  const provider = providers[name];

  if (!provider) {
    throw new Error(`Unsupported AI provider: ${name}`);
  }

  return provider;
}
