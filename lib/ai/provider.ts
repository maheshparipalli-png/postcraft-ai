import { getRuntimeAIConfig } from "./config";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAICompatibleProvider } from "./openai-compatible";
import { createOllamaProvider } from "./ollama";
import type { AIProvider } from "./types";

export async function getAIProvider(): Promise<AIProvider> {
  const config = await getRuntimeAIConfig();

  if (!config) {
    throw new Error(
      "No active AI provider is configured. Open Admin → AI Configuration and save an active provider.",
    );
  }

  switch (config.provider) {
    case "ollama":
      return createOllamaProvider({
        baseUrl: config.baseUrl ?? undefined,
        model: config.model,
      });

    case "anthropic":
      if (!config.apiKey) throw new Error("Anthropic API key is not configured.");
      return createAnthropicProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
      });

    case "freellmapi":
    case "openai":
    case "google":
    case "custom":
      if (!config.baseUrl) throw new Error("AI provider Base URL is not configured.");
      if (!config.apiKey) throw new Error("AI provider API key is not configured.");

      return createOpenAICompatibleProvider({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.model,
        providerLabel:
          config.provider === "freellmapi"
            ? "FreeLLMAPI"
            : config.provider === "openai"
              ? "OpenAI"
              : config.provider === "google"
                ? "Google"
                : "Custom provider",
      });

    default:
      throw new Error("Unsupported AI provider configuration.");
  }
}
