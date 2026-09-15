import { geminiProvider } from "./gemini";
import type { AIProvider } from "./types";

const providers: Record<string, AIProvider> = {
  gemini: geminiProvider,
};

export function getAIProvider(): AIProvider {
  const name = process.env.AI_PROVIDER ?? "gemini";
  const provider = providers[name];

  if (!provider) {
    throw new Error(`Unsupported AI provider: ${name}`);
  }

  return provider;
}
