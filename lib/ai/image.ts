import { getRuntimeAIConfig } from "./config";
import { AIProviderError } from "./errors";

export const DEFAULT_IMAGE_MODEL = "@cf/black-forest-labs/flux-2-klein-4b";

export type AIImageOptions = {
  model?: string;
  width?: number;
  height?: number;
  numImages?: number;
};

export type AIImageResult = {
  model: string;
  images: Array<{
    url?: string;
    b64Json?: string;
    mimeType: string;
  }>;
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
    throw new AIProviderError(
      "bad_request",
      "Image width and height must be whole numbers between 256 and 1536.",
      { provider: "FreeLLMAPI" },
    );
  }
  return value;
}

export async function generateAIImage(
  prompt: string,
  options: AIImageOptions = {},
): Promise<AIImageResult> {
  const cleanPrompt = prompt.trim();
  if (!cleanPrompt) {
    throw new AIProviderError("bad_request", "Image prompt is required.", { provider: "FreeLLMAPI" });
  }
  if (cleanPrompt.length > 8000) {
    throw new AIProviderError("bad_request", "Image prompt is too long.", { provider: "FreeLLMAPI" });
  }

  const config = await getRuntimeAIConfig();
  if (!config || config.provider !== "freellmapi") {
    throw new AIProviderError(
      "invalid_config",
      "FreeLLMAPI must be the active PostCraft AI provider before image generation can run.",
      { provider: "FreeLLMAPI" },
    );
  }
  if (!config.baseUrl) {
    throw new AIProviderError("invalid_config", "FreeLLMAPI Base URL is not configured.", { provider: "FreeLLMAPI" });
  }
  if (!config.apiKey) {
    throw new AIProviderError("missing_api_key", "FreeLLMAPI API key is not configured.", { provider: "FreeLLMAPI" });
  }

  const model = options.model?.trim() || DEFAULT_IMAGE_MODEL;
  if (!model.startsWith("@cf/")) {
    throw new AIProviderError(
      "bad_request",
      "Image generation currently accepts Cloudflare Workers AI image models only.",
      { provider: "FreeLLMAPI", model },
    );
  }

  const width = validateDimension(options.width, 1024);
  const height = validateDimension(options.height, 1024);
  const numImages = options.numImages ?? 1;

  if (!Number.isInteger(numImages) || numImages < 1 || numImages > 1) {
    throw new AIProviderError("bad_request", "Only one image can be generated per request.", { provider: "FreeLLMAPI" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 180_000);
  timer.unref?.();

  let response: Response;
  try {
    response = await fetch(`${normalizeBaseUrl(config.baseUrl)}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: cleanPrompt,
        width,
        height,
        num_images: numImages,
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AIProviderError("timeout", "FreeLLMAPI image generation timed out.", {
        provider: "FreeLLMAPI",
        retryable: false,
        cause: error,
      });
    }
    throw new AIProviderError("network", "Could not reach FreeLLMAPI for image generation.", {
      provider: "FreeLLMAPI",
      retryable: false,
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }

  const responseText = await response.text();
  let data: JsonRecord | null = null;
  try {
    const parsed: unknown = JSON.parse(responseText);
    data = parsed && typeof parsed === "object" ? parsed as JsonRecord : null;
  } catch {
    // handled below
  }

  if (!response.ok) {
    const message = errorMessage(data, responseText.slice(0, 500));
    if (response.status === 401 || response.status === 403) {
      throw new AIProviderError("invalid_api_key", "FreeLLMAPI rejected the configured API key.", {
        provider: "FreeLLMAPI",
        status: response.status,
      });
    }
    if (response.status === 429) {
      throw new AIProviderError("rate_limited", `FreeLLMAPI image generation is rate-limited: ${message}`, {
        provider: "FreeLLMAPI",
        status: response.status,
        retryable: true,
      });
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new AIProviderError("gateway_unavailable", `FreeLLMAPI image service is unavailable: ${message}`, {
        provider: "FreeLLMAPI",
        status: response.status,
        retryable: true,
      });
    }
    throw new AIProviderError("provider_error", `FreeLLMAPI image request failed (${response.status}): ${message}`, {
      provider: "FreeLLMAPI",
      status: response.status,
    });
  }

  if (!data) {
    throw new AIProviderError("malformed_response", "FreeLLMAPI returned a non-JSON image response.", {
      provider: "FreeLLMAPI",
    });
  }

  const rawImages = Array.isArray(data.data) ? data.data : [];
  const images = rawImages
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as JsonRecord;
      const b64Json = typeof record.b64_json === "string" ? record.b64_json : undefined;
      const url = typeof record.url === "string" ? record.url : undefined;
      if (!b64Json && !url) return null;
      return {
        ...(url ? { url } : {}),
        ...(b64Json ? { b64Json } : {}),
        mimeType: typeof record.mime_type === "string" ? record.mime_type : "image/jpeg",
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!images.length) {
    throw new AIProviderError("malformed_response", "FreeLLMAPI returned no generated images.", {
      provider: "FreeLLMAPI",
    });
  }

  return { model, images };
}
