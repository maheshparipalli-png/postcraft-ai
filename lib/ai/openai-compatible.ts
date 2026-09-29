import type { AIGenerateOptions, AIProvider } from "./types";
import { AIProviderError } from "./errors";

type JsonRecord = Record<string, unknown>;
type OpenAICompatibleConfig = { baseUrl: string; apiKey: string | null; model: string; providerLabel: string; supportsResponseFormat?: boolean; maxRetries?: number };
const REQUEST_TIMEOUT_MS = 150_000;
const TOTAL_BUDGET_MS = 240_000;

function normalizeBaseUrl(value: string) { return value.trim().replace(/\/+$/, ""); }
function getRequestBody(model: string, prompt: string, options: AIGenerateOptions, stream: boolean, supportsResponseFormat: boolean) {
  return { model, messages: [{ role: "user", content: prompt }], stream,
    ...(options.temperature !== undefined ? { temperature: options.temperature } : {}),
    ...(options.numPredict !== undefined ? { max_tokens: options.numPredict } : {}),
    ...(supportsResponseFormat && options.format ? { response_format: options.format === "json" ? { type: "json_object" } : options.format } : {}),
  };
}
function headers(apiKey: string | null) { return { "Content-Type": "application/json", ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) }; }
function errorMessage(data: JsonRecord | null, fallback: string) {
  const error = data?.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") { const message = (error as JsonRecord).message; if (typeof message === "string" && message.trim()) return message.trim(); }
  return fallback;
}
function contentToText(value: unknown) {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((item) => { if (typeof item === "string") return item; if (!item || typeof item !== "object") return ""; const text = (item as JsonRecord).text; return typeof text === "string" ? text : ""; }).join("");
}
function extractText(data: JsonRecord, provider: string) {
  const choices = Array.isArray(data.choices) ? data.choices : []; const first = choices[0];
  const message = first && typeof first === "object" ? (first as JsonRecord).message : null;
  const text = message && typeof message === "object" ? contentToText((message as JsonRecord).content) : "";
  if (!text.trim()) throw new AIProviderError("malformed_response", `${provider} returned an empty response.`, { provider });
  return text.trim();
}
function extractStreamToken(chunk: JsonRecord) {
  const choices = Array.isArray(chunk.choices) ? chunk.choices : []; const first = choices[0];
  const delta = first && typeof first === "object" ? (first as JsonRecord).delta : null;
  return delta && typeof delta === "object" ? contentToText((delta as JsonRecord).content) : "";
}
function classifyHttpError(status: number, provider: string, message: string) {
  if (status === 530) return new AIProviderError("tunnel_unavailable", `${provider} returned Cloudflare HTTP 530 (1033).`, { provider, status, retryable: true });
  if (status === 401 || status === 403) return new AIProviderError("invalid_api_key", `${provider} rejected the configured API key.`, { provider, status });
  if (status === 429) return new AIProviderError("rate_limited", `${provider} rate-limited the request: ${message}`, { provider, status, retryable: true });
  if (status === 400 || status === 422) return new AIProviderError("bad_request", `${provider} rejected the request: ${message}`, { provider, status });
  if (status === 502 || status === 503 || status === 504) return new AIProviderError("gateway_unavailable", `${provider} is unavailable (${status}): ${message}`, { provider, status, retryable: true });
  return new AIProviderError("provider_error", `${provider} request failed (${status}): ${message}`, { provider, status });
}
function retryDelay(attempt: number) { return Math.min(4000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250); }

export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): AIProvider {
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const provider = config.providerLabel;
  const supportsResponseFormat = config.supportsResponseFormat ?? true;
  const configuredRetries = config.maxRetries ?? Number(process.env.AI_PROVIDER_MAX_RETRIES || 2);\n  const maxRetries = Number.isFinite(configuredRetries) ? Math.min(3, Math.max(0, Math.floor(configuredRetries))) : 2;
  if (!/^https?:\/\//i.test(baseUrl)) throw new AIProviderError("invalid_config", `${provider} Base URL must start with http:// or https://`, { provider });

  async function requestOnce(prompt: string, options: AIGenerateOptions, stream: boolean, onToken?: (token: string) => void, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));\n    timer.unref?.();
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(getRequestBody(config.model, prompt, options, stream, supportsResponseFormat)), cache: "no-store", signal: controller.signal });
    } catch (error) {
      if (controller.signal.aborted) throw new AIProviderError("timeout", `${provider} request timed out.`, { provider, retryable: false, cause: error });
      throw new AIProviderError("network", `Could not reach ${provider}. Check the configured Base URL and network connectivity.`, { provider, retryable: true, cause: error });
    }
    if (!stream) {
      const responseText = await response.text(); let data: JsonRecord | null = null;
      try { const parsed: unknown = JSON.parse(responseText); data = parsed && typeof parsed === "object" ? parsed as JsonRecord : null; } catch { /* handled by error classification */ }
      if (!response.ok) throw classifyHttpError(response.status, provider, errorMessage(data, responseText.slice(0, 400)));
      if (!data) throw new AIProviderError("malformed_response", `${provider} returned a non-JSON response.`, { provider });
      return extractText(data, provider);
    }
    if (!response.ok) {
      const responseText = await response.text(); let data: JsonRecord | null = null;
      try { const parsed: unknown = JSON.parse(responseText); data = parsed && typeof parsed === "object" ? parsed as JsonRecord : null; } catch { /* use raw preview */ }
      throw classifyHttpError(response.status, provider, errorMessage(data, responseText.slice(0, 400)));
    }
    const body = response.body;
    if (!body) throw new AIProviderError("malformed_response", `${provider} did not return a streaming response.`, { provider });
    const reader = body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let fullText = "";
    const consumeLine = (rawLine: string) => { const line = rawLine.trim(); if (!line.startsWith("data:")) return; const payload = line.slice(5).trim(); if (!payload || payload === "[DONE]") return; try { const token = extractStreamToken(JSON.parse(payload)); if (token) { fullText += token; onToken?.(token); } } catch { /* ignore incomplete/malformed SSE event */ } };
    try {
      while (true) { const { value, done } = await reader.read(); if (done) break; buffer += decoder.decode(value, { stream: true }); const lines = buffer.split("\n"); buffer = lines.pop() ?? ""; for (const line of lines) consumeLine(line); }
      buffer += decoder.decode(); if (buffer.trim()) for (const line of buffer.split("\n")) consumeLine(line);
    } catch (error) {
      throw new AIProviderError("network", `${provider} streaming connection was interrupted. Please try again.`, { provider, retryable: false, cause: error });
    } finally { reader.releaseLock(); }
    if (!fullText.trim()) throw new AIProviderError("malformed_response", `${provider} returned an empty streaming response.`, { provider });
    return fullText.trim();
  }

  async function request(prompt: string, options: AIGenerateOptions, stream: boolean, onToken?: (token: string) => void) {
    const startedAt = Date.now(); let attempt = 0; let lastError: unknown;
    while (attempt <= maxRetries) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining <= 1000) break;
      const timeoutMs = Math.min(REQUEST_TIMEOUT_MS, remaining);
      try { return await requestOnce(prompt, options, stream, onToken, timeoutMs); }
      catch (error) {
        lastError = error;
        if (!(error instanceof AIProviderError) || !error.retryable || attempt >= maxRetries) throw error;
        attempt += 1;
        const delay = Math.min(retryDelay(attempt - 1), Math.max(0, TOTAL_BUDGET_MS - (Date.now() - startedAt) - 1000));
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError instanceof Error ? lastError : new AIProviderError("provider_error", `${provider} request failed.`, { provider });
  }

  return {
    generateText(prompt, options = {}) { return request(prompt, options, false); },
    generateTextStream(prompt, options = {}, onToken) { return request(prompt, options, true, onToken); },
  };
}