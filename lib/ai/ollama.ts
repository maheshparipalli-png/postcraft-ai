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
      stream: true,
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
          // Stream Ollama's NDJSON response so Cloudflare receives data
          // while the model is generating instead of waiting for the
          // complete response. This avoids Cloudflare 524 idle timeouts.
          stream: true,
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

    if (!response.ok) {
      const responseText = await response.text();

      console.error("[Ollama] Error response", {
        status: response.status,
        statusText: response.statusText,
        elapsedMs: Date.now() - startedAt,
        contentType: response.headers.get("content-type"),
        bodyLength: responseText.length,
        bodyPreview: responseText.slice(0, 500),
      });

      let data: { error?: string } | null = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        // Keep data null for non-JSON responses.
      }

      throw new Error(
        data?.error ??
          `Ollama request failed (${response.status}): ${responseText.slice(
            0,
            300
          )}`
      );
    }

    if (!response.body) {
      throw new Error("Ollama returned an empty response stream");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          let chunk: {
            error?: string;
            done?: boolean;
            message?: {
              content?: string;
            };
          };

          try {
            chunk = JSON.parse(trimmed);
          } catch {
            console.warn("[Ollama] Ignoring malformed stream chunk");
            continue;
          }

          if (chunk.error) {
            throw new Error(chunk.error);
          }

          if (typeof chunk.message?.content === "string") {
            text += chunk.message.content;
          }
        }
      }

      buffer += decoder.decode();

      const trailing = buffer.trim();
      if (trailing) {
        try {
          const chunk = JSON.parse(trailing) as {
            error?: string;
            message?: { content?: string };
          };

          if (chunk.error) {
            throw new Error(chunk.error);
          }

          if (typeof chunk.message?.content === "string") {
            text += chunk.message.content;
          }
        } catch (error) {
          if (error instanceof Error && error.message !== "Unexpected end of JSON input") {
            throw error;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    const elapsedMs = Date.now() - startedAt;

    console.log("[Ollama] Response", {
      status: response.status,
      statusText: response.statusText,
      elapsedMs,
      contentType: response.headers.get("content-type"),
      outputLength: text.length,
    });

    if (!text.trim()) {
      throw new Error("Ollama returned an empty response");
    }

    console.log("[Ollama] Generation complete", {
      elapsedMs,
      outputLength: text.length,
    });

    return text.trim();
  },
};
