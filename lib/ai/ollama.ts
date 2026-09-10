import type { AIGenerateOptions, AIProvider } from "./types";

const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

export const ollamaProvider: AIProvider = {
  async generateText(prompt, options: AIGenerateOptions = {}) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          stream: false,
          ...(options.format ? { format: options.format } : {}),
          options: {
            temperature: options.temperature ?? 0.78,
            num_predict: options.numPredict ?? 400,
          },
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error("PostCraft AI took too long to respond. Please try again.");
      }
      throw error;
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error ?? `Ollama request failed (${response.status})`);
    }

    const text = data?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Ollama returned an empty response");
    }

    return text.trim();
  },
};
