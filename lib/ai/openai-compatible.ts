import type { AIGenerateOptions, AIProvider } from "./types";

type JsonRecord = Record<string, unknown>;

type OpenAICompatibleConfig = {
  baseUrl: string;
  apiKey: string | null;
  model: string;
  providerLabel: string;
};

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getRequestBody(model: string, prompt: string, options: AIGenerateOptions, stream: boolean) {
  return {
    model,
    messages: [{ role: "user", content: prompt }],
    stream,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.numPredict !== undefined ? { max_tokens: options.numPredict } : {}),
    ...(options.format
      ? { response_format: options.format === "json" ? { type: "json_object" } : options.format }
      : {}),
  };
}

function headers(apiKey: string | null) {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

function errorMessage(data: JsonRecord | null, fallback: string) {
  const error = data?.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const message = (error as JsonRecord).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return fallback;
}

function contentToText(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const text = (item as JsonRecord).text;
      return typeof text === "string" ? text : "";
    })
    .join("");
}

function extractText(data: JsonRecord) {
  const choices = Array.isArray(data.choices) ? data.choices : [];
  const first = choices[0];
  const message = first && typeof first === "object" ? (first as JsonRecord).message : null;
  const text = message && typeof message === "object"
    ? contentToText((message as JsonRecord).content)
    : "";
  if (!text.trim()) {
    throw new Error("returned an empty response.");
  }
  return text.trim();
}

function extractStreamToken(chunk: JsonRecord) {
  const choices = Array.isArray(chunk.choices) ? chunk.choices : [];
  const first = choices[0];
  const delta = first && typeof first === "object" ? (first as JsonRecord).delta : null;
  const token = delta && typeof delta === "object"
    ? contentToText((delta as JsonRecord).content)
    : "";
  return token;
}

export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): AIProvider {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new Error(`${config.providerLabel} Base URL must start with http:// or https://`);
  }

  async function request(
    prompt: string,
    options: AIGenerateOptions,
    stream: boolean,
    onToken?: (token: string) => void,
  ) {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: headers(config.apiKey),
        body: JSON.stringify(getRequestBody(config.model, prompt, options, stream)),
        cache: "no-store",
        signal: AbortSignal.timeout(150_000),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "TimeoutError") {
        throw new Error(`${config.providerLabel} request timed out after 150 seconds.`);
      }
      throw new Error(
        `Could not reach ${config.providerLabel}. Check the configured Base URL and network connectivity.`,
        { cause: error },
      );
    }

    if (!stream) {
      const responseText = await response.text();
      let data: JsonRecord | null = null;

      try {
        const parsed: unknown = JSON.parse(responseText);
        data = parsed && typeof parsed === "object" ? parsed as JsonRecord : null;
      } catch {
        // Keep the raw response for a useful error below.
      }

      if (!response.ok) {
        const message = errorMessage(data, responseText.slice(0, 400));
        if (response.status === 530) {
          throw new Error(
            `${config.providerLabel} returned Cloudflare HTTP 530. Check the provider hostname, DNS, tunnel, and origin service.`,
          );
        }
        throw new Error(`${config.providerLabel} request failed (${response.status}): ${message}`);
      }

      try {
        if (!data) throw new Error("empty");
        return extractText(data);
      } catch {
        throw new Error(`${config.providerLabel} returned an empty response.`);
      }
    }

    if (!response.ok) {
      const responseText = await response.text();
      let data: JsonRecord | null = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        // Keep the raw response for a useful error below.
      }

      const message = errorMessage(data, responseText.slice(0, 400));
      if (response.status === 530) {
        throw new Error(
          `${config.providerLabel} returned Cloudflare HTTP 530. Check the provider hostname, DNS, tunnel, and origin service.`,
        );
      }
      throw new Error(`${config.providerLabel} request failed (${response.status}): ${message}`);
    }

    const body = response.body;
    if (!body) throw new Error(`${config.providerLabel} did not return a streaming response.`);

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    const consumeLine = (rawLine: string) => {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) return false;

      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") return false;

      try {
        const chunk = JSON.parse(payload);
        const token = extractStreamToken(chunk);
        if (token) {
          fullText += token;
          onToken?.(token);
        }
      } catch {
        // Ignore malformed SSE fragments; the next chunk may contain a complete event.
      }

      return false;
    };

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) consumeLine(line);
      }

      buffer += decoder.decode();
      if (buffer.trim()) {
        for (const line of buffer.split("\n")) consumeLine(line);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error(`${config.providerLabel} streaming request timed out or was cancelled.`, { cause: error });
      }
      throw new Error(
        `${config.providerLabel} streaming connection was interrupted. Please try again.`,
        { cause: error },
      );
    } finally {
      reader.releaseLock();
    }

    if (!fullText.trim()) {
      throw new Error(`${config.providerLabel} returned an empty streaming response.`);
    }

    return fullText.trim();
  }

  return {
    generateText(prompt, options = {}) {
      return request(prompt, options, false);
    },
    generateTextStream(prompt, options = {}, onToken) {
      return request(prompt, options, true, onToken);
    },
  };
}
