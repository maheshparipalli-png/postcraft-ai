import { getRuntimeAIConfig } from "./config";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import { createOllamaProvider } from "./ollama";
import { AIProviderError } from "./errors";
import type { AIProvider } from "./types";

export async function getAIProvider(): Promise<AIProvider> {
  const config = await getRuntimeAIConfig();
  if (!config) throw new AIProviderError("not_configured", "No active AI provider is configured.", { provider: "PostCraft AI" });
  switch (config.provider) {
    case "ollama":
      return createOllamaProvider({ baseUrl: config.baseUrl ?? undefined, model: config.model });
    case "anthropic":
      if (!config.apiKey) throw new AIProviderError("missing_api_key", "Anthropic API key is not configured.", { provider: "Anthropic" });
      return createAnthropicProvider({ baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model });
    case "freellmapi":
    case "openai":
    case "google":
    case "custom": {
      const providerLabel = config.provider === "freellmapi" ? "FreeLLMAPI" : config.provider === "openai" ? "OpenAI" : config.provider === "google" ? "Google" : "Custom provider";
      if (!config.baseUrl) throw new AIProviderError("invalid_config", `${providerLabel} Base URL is not configured.`, { provider: providerLabel });
      if (!config.apiKey) throw new AIProviderError("missing_api_key", `${providerLabel} API key is not configured.`, { provider: providerLabel });
      return createOpenAICompatibleProvider({
        baseUrl: config.baseUrl, apiKey: config.apiKey, model: config.model, providerLabel,
        supportsResponseFormat: config.provider !== "freellmapi",
      });
    }
    default:
      throw new AIProviderError("invalid_config", "Unsupported AI provider configuration.", { provider: "PostCraft AI" });
  }
}