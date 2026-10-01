export type ModelCapability = "text" | "image";

export type ModelCatalogEntry = {
  id: string;
  name: string;
  capability: ModelCapability;
  provider: "freellmapi" | "openai";
  verified: boolean;
  source: "live" | "curated";
};

/**
 * Image models verified against the current FreeLLMAPI Cloudflare catalog.
 * These are intentionally kept explicit because /v1/models does not reliably
 * expose modality across all router versions.
 */
export const VERIFIED_FREELLMAPI_IMAGE_MODELS: ModelCatalogEntry[] = [
  { id: "@cf/black-forest-labs/flux-1-schnell", name: "FLUX.1 Schnell", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/stabilityai/stable-diffusion-xl-base-1.0", name: "Stable Diffusion XL", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/black-forest-labs/flux-2-klein-9b", name: "FLUX.2 Klein 9B", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/black-forest-labs/flux-2-klein-4b", name: "FLUX.2 Klein 4B", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/bytedance/stable-diffusion-xl-lightning", name: "Stable Diffusion XL Lightning", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/lykon/dreamshaper-8-lcm", name: "DreamShaper 8 LCM", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/black-forest-labs/flux-2-dev", name: "FLUX.2 Dev", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/leonardo/lucid-origin", name: "Lucid Origin", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
  { id: "@cf/leonardo/phoenix-1.0", name: "Phoenix 1.0", capability: "image", provider: "freellmapi", verified: true, source: "curated" },
];

export const VERIFIED_OPENAI_IMAGE_MODELS: ModelCatalogEntry[] = [
  { id: "gpt-image-2", name: "GPT Image 2", capability: "image", provider: "openai", verified: true, source: "curated" },
];

export function getVerifiedImageModels(provider: "freellmapi" | "openai") {
  return provider === "freellmapi"
    ? VERIFIED_FREELLMAPI_IMAGE_MODELS
    : VERIFIED_OPENAI_IMAGE_MODELS;
}

export function normalizeModelList(data: unknown): string[] {
  if (!data || typeof data !== "object") return [];
  const record = data as { data?: unknown };
  if (!Array.isArray(record.data)) return [];

  return record.data
    .map((item) => {
      if (typeof item === "string") return item;
      if (!item || typeof item !== "object") return "";
      const id = (item as { id?: unknown }).id;
      return typeof id === "string" ? id : "";
    })
    .filter(Boolean);
}
