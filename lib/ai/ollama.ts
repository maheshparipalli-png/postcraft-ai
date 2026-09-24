import type { AIGenerateOptions, AIProvider } from "./types";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getOllamaConfig() {
  const baseUrl = normalizeBaseUrl(
    process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
  );
  const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:7b";

  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error("OLLAMA_BASE_URL must start with http:// or https://");
  }

  return { baseUrl, model };
}

function getCloudflareAccessHeaders(): Record<string, string> {
  const clientId = process.env.CF_ACCESS_CLIENT_ID?.trim();
  const clientSecret = process.env.CF_ACCESS_CLIENT_SECRET?.trim();

  if (clientId && clientSecret) {
    return {
      "CF-Access-Client-Id": clientId,
      "CF-Access-Client-Secret": clientSecret,
    };
  }

  return {};
}

function getRequestBody(model: string, prompt: string, options: AIGenerateOptions, stream: boolean) {
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    stream,
    ...(options.format ? { format: options.format } : {}),
    options: {
      temperature: options.temperature ?? 0.78,
      num_predict: options.numPredict ?? 400,
    },
  };
}

async function requestOllama(
  prompt: string,
  options: AIGenerateOptions,
  stream: boolean,
  onToken?: (token: string) => void,
) {
  const { baseUrl, model } = getOllamaConfig();
  const ollamaUrl = `${baseUrl}/api/chat`;
  const accessHeaders = getCloudflareAccessHeaders();
  const startedAt = Date.now();

  console.log("[Ollama] Sending request", {
    url: ollamaUrl,
    model,
    hasAccessHeaders: Object.keys(accessHeaders).length > 0,
    promptLength: prompt.length,
    numPredict: options.numPredict ?? 400,
    format: options.format ?? "text",
    stream,
  });

  let response: Response;

  try {
    response = await fetch(ollamaUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...accessHeaders,
      },
      body: JSON.stringify(getRequestBody(model, prompt, options, stream)),
      cache: "no-store",
      signal: AbortSignal.timeout(90_000),
    });
  } catch (error) {
    console.error("[Ollama] Request failed", {
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });

    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new Error("PostCraft AI took too long to respond. Please try again.");
    }

    throw new Error(
      "PostCraft could not reach the Ollama service. Check OLLAMA_BASE_URL and make sure the endpoint is reachable from the server.",
      { cause: error },
    );
  }

  if (!response.ok) {
    const responseText = await response.text();
    let data: { error?: string } | null = null;

    try {
      data = JSON.parse(responseText);
    } catch {
      // Non-JSON errors are handled below.
    }

    console.error("[Ollama] Error response", {
      status: response.status,
      statusText: response.statusText,
      elapsedMs: Date.now() - startedAt,
      bodyLength: responseText.length,
      bodyPreview: responseText.slice(0, 500),
    });

    if (response.status === 530) {
      throw new Error(
        "Ollama endpoint returned Cloudflare HTTP 530. The configured OLLAMA_BASE_URL is not resolving to a reachable Ollama origin. Check the URL, DNS/Cloudflare tunnel, and Cloudflare Access settings.",
      );
    }

    throw new Error(
      data?.error ??
        `Ollama request failed (${response.status}): ${responseText.slice(0, 300)}`,
    );
  }

  if (!stream) {
    try {
      const responseText = await response.text();
      let data: { error?: string; message?: { content?: string }; response?: string };

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error("Ollama returned an invalid response.");
      }

      if (data.error) throw new Error(data.error);

      const text = typeof data.message?.content === "string"
        ? data.message.content
        : typeof data.response === "string"
          ? data.response
          : "";

      if (!text.trim()) throw new Error("Ollama returned an empty response");

      console.log("[Ollama] Generation complete", {
        elapsedMs: Date.now() - startedAt,
        outputLength: text.length,
      });

      return text.trim();
    } catch (error) {
      console.error("[Ollama] Response read failed", {
        elapsedMs: Date.now() - startedAt,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });

      if (error instanceof Error && /terminated|aborted|socket|connection|network/i.test(error.message)) {
        throw new Error(
          "The Ollama connection was terminated while generating the draft. Please try again; if it repeats, check the Ollama Cloudflare tunnel.",
          { cause: error },
        );
      }

      throw error;
    }
  }

  if (!response.body) {
    throw new Error("Ollama did not return a streaming response.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;

        let chunk: {
          done?: boolean;
          error?: string;
          message?: { content?: string };
          response?: string;
        };

        try {
          chunk = JSON.parse(line);
        } catch {
          continue;
        }

        if (chunk.error) throw new Error(chunk.error);

        const token =
          typeof chunk.message?.content === "string"
            ? chunk.message.content
            : typeof chunk.response === "string"
              ? chunk.response
              : "";

        if (token) {
          fullText += token;
          onToken?.(token);
        }

        if (chunk.done) break;
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        const token =
          typeof chunk.message?.content === "string"
            ? chunk.message.content
            : typeof chunk.response === "string"
              ? chunk.response
              : "";
        if (token) {
          fullText += token;
          onToken?.(token);
        }
      } catch {
        // Ignore an incomplete trailing NDJSON fragment.
      }
    }
  } catch (error) {
    console.error("[Ollama] Stream read failed", {
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });

    if (error instanceof Error && /terminated|aborted|socket|connection|network/i.test(error.message)) {
      throw new Error(
        "The Ollama connection was terminated while streaming the draft. Please try again; if it repeats, check the Ollama Cloudflare tunnel.",
        { cause: error },
      );
    }

    throw error;
  } finally {
    reader.releaseLock();
  }

  if (!fullText.trim()) throw new Error("Ollama returned an empty streaming response.");

  console.log("[Ollama] Streaming generation complete", {
    elapsedMs: Date.now() - startedAt,
    outputLength: fullText.length,
  });

  return fullText.trim();
}

export const ollamaProvider: AIProvider = {
  generateText(prompt: string, options: AIGenerateOptions = {}) {
    return requestOllama(prompt, options, false);
  },

  generateTextStream(
    prompt: string,
    options: AIGenerateOptions = {},
    onToken: (token: string) => void,
  ) {
    return requestOllama(prompt, options, true, onToken);
  },
};
