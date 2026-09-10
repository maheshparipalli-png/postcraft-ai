import type { AIProvider } from "./types";

const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const model = process.env.OLLAMA_MODEL ?? "llama3.2";

export const ollamaProvider: AIProvider = {
  async generateText(prompt) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        stream: false,
        options: {
          temperature: 0.65,
          num_predict: 500,
        },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(
        data?.error ?? `Ollama request failed (${response.status})`
      );
    }

    const text = data?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Ollama returned an empty response");
    }

    return text.trim();
  },
};
