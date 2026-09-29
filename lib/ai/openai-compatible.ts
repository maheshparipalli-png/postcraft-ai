import type { AIGenerateOptions, AIProvider } from "./types";

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

function extractText(data: any) {
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("returned an empty response.");
  }
  return text.trim();
}

function extractStreamToken(chunk: any) {
  const token = chunk?.choices?.[0]?.delta?.content;
  return typeof token === "string" ? token : "";
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
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        // Keep the raw response for a useful error below.
      }

      if (!response.ok) {
        const message = data?.error?.message || data?.error || responseText.slice(0, 400);
        throw new Error(`${config.providerLabel} request failed (${response.status}): ${message}`);
      }

      try {
        return extractText(data);
      } catch {
        throw new Error(`${config.providerLabel} returned an empty response.`);
      }
    }

    if (!response.ok) {
      const responseText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        // Keep the raw response for a useful error below.
      }

      const message = data?.error?.message || data?.error || responseText.slice(0, 400);
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
