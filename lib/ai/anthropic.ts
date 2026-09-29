import type { AIGenerateOptions, AIProvider } from "./types";

export function createAnthropicProvider(config: { baseUrl?: string | null; apiKey: string; model: string }): AIProvider {
  const baseUrl = (config.baseUrl?.trim() || "https://api.anthropic.com").replace(/\/+$/, "");

  async function request(prompt: string, options: AIGenerateOptions) {
    const response = await fetch(`${baseUrl}/v1/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: options.numPredict ?? 400,
        temperature: options.temperature ?? 0.78,
        messages: [{ role: "user", content: prompt }],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(150_000),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.error?.message || `Anthropic request failed (${response.status}).`);

    const text = data?.content?.map((item: { text?: string }) => item.text || "").join("") || "";
    if (!text.trim()) throw new Error("Anthropic returned an empty response.");
    return text.trim();
  }

  return {
    generateText(prompt, options = {}) {
      return request(prompt, options);
    },
    async generateTextStream(prompt, options = {}, onToken) {
      const text = await request(prompt, options);
      onToken(text);
      return text;
    },
  };
}
