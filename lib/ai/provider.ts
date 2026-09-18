import { ollamaProvider } from "./ollama";
import type { AIProvider } from "./types";

/**
 * PostCraft AI uses Ollama as its only AI provider.
 *
 * Provider selection is intentionally not controlled by an environment
 * variable. This prevents an old AI_PROVIDER value in Vercel from routing
 * requests to a removed/unsupported provider.
 */
export function getAIProvider(): AIProvider {
  return ollamaProvider;
}
