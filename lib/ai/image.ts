import { getRuntimeImageConfigs } from "./image-config";
import { AIProviderError } from "./errors";

export const DEFAULT_IMAGE_MODELS = {
  freellmapi: "@cf/black-forest-labs/flux-2-klein-4b",
  openai: "gpt-image-2",
} as const;

export type AIImageOptions = {
  model?: string;
  width?: number;
  height?: number;
  numImages?: number;
};

export type AIImageResult = {
  provider: string;
  model: string;
  images: Array<{ url?: string; b64Json?: string; mimeType: string }>;
};

type JsonRecord = Record<string, unknown>;

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
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

function validateDimension(value: number | undefined, fallback: number) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 256 || value > 1536) {
    throw new AIProviderError("bad_request", "Image width and height must be whole numbers between 256 and 1536.", {
      provider: "Image provider",
    });
  }
  return value;
}

async function requestJson(url: string, apiKey: string, body: JsonRecord, provider: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  timer.unref?.();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    const responseText = await response.text();
    let data: JsonRecord | null = null;
    try {
      const parsed: unknown = JSON.parse(responseText);
      data = parsed && typeof parsed === "object" ? parsed as JsonRecord : null;
    } catch {}

    if (!response.ok) {
      const message = errorMessage(data, responseText.slice(0, 500));
      if (response.status === 401 || response.status === 403) {
        throw new AIProviderError("invalid_api_key", `${provider} rejected the configured API key.`, { provider, status: response.status });
      }
      if (response.status === 429) {
        throw new AIProviderError("rate_limited", `${provider} image generation is rate-limited: ${message}`, { provider, status: response.status, retryable: true });
      }
      if ([502, 503, 504].includes(response.status)) {
        throw new AIProviderError("gateway_unavailable", `${provider} image service is unavailable: ${message}`, { provider, status: response.status, retryable: true });
      }
      throw new AIProviderError("provider_error", `${provider} image request failed (${response.status}): ${message}`, { provider, status: response.status });
    }

    if (!data) {
      throw new AIProviderError("malformed_response", `${provider} returned a non-JSON image response.`, { provider });
    }
    return data;
  } catch (error) {
    if (error instanceof AIProviderError) throw error;
    if (controller.signal.aborted) {
      throw new AIProviderError("timeout", `${provider} image generation timed out.`, { provider });
    }
    throw new AIProviderError("network", `Could not reach ${provider} for image generation.`, { provider });
  } finally {
    clearTimeout(timer);
  }
}

function parseImages(data: JsonRecord, provider: string) {
  // OpenAI-compatible providers commonly return images under `data`.
  // FreeLLMAPI/Cloudflare image responses can return them under `images`.
  const rawImages = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.images)
      ? data.images
      : [];

  const images = rawImages.map((item) => {
    if (typeof item === "string") {
      return {
        b64Json: item,
        mimeType: "image/png",
      };
    }

    if (!item || typeof item !== "object") return null;
    const record = item as JsonRecord;
    const b64Json =
      typeof record.b64_json === "string"
        ? record.b64_json
        : typeof record.base64 === "string"
          ? record.base64
          : undefined;
    const url = typeof record.url === "string" ? record.url : undefined;
    if (!b64Json && !url) return null;

    return {
      ...(url ? { url } : {}),
      ...(b64Json ? { b64Json } : {}),
      mimeType:
        typeof record.mime_type === "string"
          ? record.mime_type
          : typeof record.mimeType === "string"
            ? record.mimeType
            : "image/png",
    };
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!images.length) {
    throw new AIProviderError("malformed_response", `${provider} returned no generated images.`, { provider });
  }
  return images;
}

async function generateWithProvider(config: {
  provider: "freellmapi" | "openai";
  baseUrl: string | null;
  model: string;
  apiKey: string;
}, prompt: string, width: number, height: number) {
  const provider = config.provider === "freellmapi" ? "FreeLLMAPI" : "OpenAI";
  const baseUrl = normalizeBaseUrl(config.baseUrl || (config.provider === "openai" ? "https://api.openai.com/v1" : ""));
  if (!baseUrl) {
    throw new AIProviderError("invalid_config", `${provider} Base URL is not configured.`, { provider });
  }

  if (config.provider === "freellmapi") {
    if (!config.model.startsWith("@cf/")) {
      throw new AIProviderError("bad_request", "FreeLLMAPI image models must use a Cloudflare Workers AI model ID.", { provider });
    }
    const data = await requestJson(`${baseUrl}/images/generations`, config.apiKey, {
      model: config.model,
      prompt,
      width,
      height,
      num_images: 1,
    }, provider);
    return parseImages(data, provider);
  }

  const size = width === height ? "1024x1024" : width > height ? "1536x1024" : "1024x1536";
  const data = await requestJson(`${baseUrl}/images/generations`, config.apiKey, {
    model: config.model,
    prompt,
    size,
    n: 1,
  }, provider);
  return parseImages(data, provider);
}

export async function generateAIImage(prompt: string, options: AIImageOptions = {}): Promise<AIImageResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) throw new AIProviderError("bad_request", "Image prompt is required.", { provider: "Image provider" });
  if (cleanPrompt.length > 8000) throw new AIProviderError("bad_request", "Image prompt is too long.", { provider: "Image provider" });

  const configs = await getRuntimeImageConfigs();
  if (!configs.length) {
    throw new AIProviderError(
      "invalid_config",
      "No image provider is configured. Configure FreeLLMAPI or OpenAI under AI Configuration.",
      { provider: "Image Router" },
    );
  }

  const width = validateDimension(options.width, 1200);
  const height = validateDimension(options.height, 1500);
  const requestedModel = options.model;
  const requestedCandidates = requestedModel
    ? configs.filter((config) =>
        config.model === requestedModel ||
        (config.provider === "freellmapi" && requestedModel.startsWith("@cf/")),
      )
    : [];

  // Prefer the requested style model, but keep the normal configured provider
  // as a fallback so a missing optional model never breaks image generation.
  const candidates = requestedModel
    ? [...requestedCandidates, ...configs.filter((config) => !requestedCandidates.includes(config))]
    : configs;

  if (!candidates.length) {
    throw new AIProviderError("invalid_config", "No usable image provider is configured.", { provider: "Image Router" });
  }

  const failures: string[] = [];
  for (const config of candidates) {
    try {
      const requestConfig = requestedModel && config.provider === "freellmapi"
        ? { ...config, model: requestedModel }
        : config;
      const images = await generateWithProvider(requestConfig, cleanPrompt, width, height);
      return { provider: config.provider, model: requestConfig.model, images };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${config.provider}: ${message}`);
      console.warn("[PostCraft] image provider failed; trying next provider", {
        provider: config.provider,
        model: config.model,
        message,
      });
    }
  }

  throw new AIProviderError("provider_error", `All configured image providers failed. ${failures.join(" | ")}`, {
    provider: "Image Router",
  });
}
