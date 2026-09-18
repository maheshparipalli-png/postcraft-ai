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
  async generateText(prompt: string, options: AIGenerateOptions = {}) {
    const ollamaUrl = `${baseUrl}/api/chat`;
    const startedAt = Date.now();

    console.log("[Ollama] Sending request", {
      url: ollamaUrl,
      model,
      hasAccessHeaders: Boolean(accessClientId && accessClientSecret),
      promptLength: prompt.length,
      numPredict: options.numPredict ?? 400,
      format: options.format ?? "text",
    });

    let response: Response;

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

        // Ollama can take longer than 90 seconds on the local machine.
        signal: AbortSignal.timeout(180_000),
      });
    } catch (error) {
      const elapsedMs = Date.now() - startedAt;

      console.error("[Ollama] Request failed", {
        elapsedMs,
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : String(error),
      });

      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error(
          "PostCraft AI took too long to respond. Please try again."
        );
      }

      throw error;
    }

    const elapsedMs = Date.now() - startedAt;
    const responseText = await response.text();

    console.log("[Ollama] Response", {
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      contentType: response.headers.get("content-type"),
      bodyLength: responseText.length,
      bodyPreview: responseText.slice(0, 500),
    });

    let data: {
      error?: string;
      message?: {
        content?: string;
      };
    } | null = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      // Keep data null for non-JSON responses.
    }

    if (!response.ok) {
      throw new Error(
        data?.error ??
          `Ollama request failed (${response.status}): ${responseText.slice(
            0,
            300
          )}`
      );
    }

    const text = data?.message?.content;

    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Ollama returned an empty response");
    }

    console.log("[Ollama] Generation complete", {
      elapsedMs,
      outputLength: text.length,
    });

    return text.trim();
  },
};
