import { ollamaProvider } from "./ollama";
import type { AIProvider } from "./types";

/**
 * PostCraft AI uses Ollama as its only AI provider.
 *
 * Keep the provider selection explicit here so an old Vercel
 * AI_PROVIDER=gemini environment variable can never route requests
 * back to Gemini.
 */
export function getAIProvider(): AIProvider {
  return ollamaProvider;
}
