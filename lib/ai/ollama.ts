import type { AIGenerateOptions, AIProvider } from "./types";

const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const model = process.env.OLLAMA_MODEL ?? "qwen2.5:7b";

const accessClientId = process.env.CF_ACCESS_CLIENT_ID;
const accessClientSecret = process.env.CF_ACCESS_CLIENT_SECRET;

console.log("[Ollama] Configuration", {
  baseUrl,
  model,
  hasClientId: Boolean(accessClientId),
  hasClientSecret: Boolean(accessClientSecret),
});

export const ollamaProvider: AIProvider = {
  async generateText(prompt, options: AIGenerateOptions = {}) {
    let response: Response;

    const ollamaUrl = `${baseUrl}/api/chat`;

    console.log("[Ollama] Sending request", {
      url: ollamaUrl,
      model,
      hasAccessHeaders: Boolean(accessClientId && accessClientSecret),
    });

    try {
      response = await fetch(ollamaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",

          ...(accessClientId && accessClientSecret
            ? {
                "CF-Access-Client-Id": accessClientId,
                "CF-Access-Client-Secret": accessClientSecret,
              }
            : {}),
        },
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
        signal: AbortSignal.timeout(90_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error("PostCraft AI took too long to respond. Please try again.");
      }

      throw error;
    }

    const responseText = await response.text();

    console.log("[Ollama] Response", {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get("content-type"),
      bodyPreview: responseText.slice(0, 500),
    });

    let data: { error?: string; message?: { content?: string } } | null = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      // Keep data as null for non-JSON responses, such as Cloudflare HTML.
    }

    if (!response.ok) {
      throw new Error(
        data?.error ??
          `Ollama request failed (${response.status}): ${responseText.slice(0, 300)}`
      );
    }

    const text = data?.message?.content;

    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Ollama returned an empty response");
    }

    return text.trim();
  },
};
