import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type AIProviderName =
  | "ollama"
  | "freellmapi"
  | "openai"
  | "anthropic"
  | "google"
  | "custom";

export type AIProviderConfig = {
  id: string;
  provider: AIProviderName;
  baseUrl: string | null;
  model: string;
  apiKeyConfigured: boolean;
  isActive: boolean;
  updatedAt: string;
};

type StoredConfig = {
  id: string;
  provider: AIProviderName;
  base_url: string | null;
  model: string;
  encrypted_api_key: string | null;
  is_active: boolean;
  updated_at: string;
};

function getEncryptionKey() {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY?.trim();
  if (!secret) {
    throw new Error("AI_CONFIG_ENCRYPTION_KEY is not configured.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decryptSecret(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored AI provider secret is invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), ivText ? Buffer.from(ivText, "base64url") : Buffer.alloc(0));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export async function getStoredAIConfig(): Promise<StoredConfig | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_provider_configs")
    .select("id,provider,base_url,model,encrypted_api_key,is_active,updated_at")
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as StoredConfig | null;
}

export async function getPublicAIConfig(): Promise<AIProviderConfig | null> {
  const config = await getStoredAIConfig();
  if (!config) return null;

  return {
    id: config.id,
    provider: config.provider,
    baseUrl: config.base_url,
    model: config.model,
    apiKeyConfigured: Boolean(config.encrypted_api_key),
    isActive: config.is_active,
    updatedAt: config.updated_at,
  };
}

export async function getRuntimeAIConfig() {
  const config = await getStoredAIConfig();
  if (!config) return null;

  return {
    provider: config.provider,
    baseUrl: config.base_url,
    model: config.model,
    apiKey: config.encrypted_api_key ? decryptSecret(config.encrypted_api_key) : null,
  };
}

export async function saveAIConfig(input: {
  provider: AIProviderName;
  baseUrl: string | null;
  model: string;
  apiKey?: string | null;
}) {
  const admin = createAdminClient();
  const existing = await getStoredAIConfig();
  const apiKey = input.apiKey?.trim() || null;

  const payload: Record<string, unknown> = {
    provider: input.provider,
    base_url: input.baseUrl,
    model: input.model,
    is_active: true,
    updated_at: new Date().toISOString(),
    encrypted_api_key:
      input.provider === "ollama"
        ? null
        : apiKey
          ? encryptSecret(apiKey)
          : existing?.provider === input.provider
            ? existing.encrypted_api_key
            : null,
  };

  if (existing?.id) {
    const { data, error } = await admin
      .from("ai_provider_configs")
      .update(payload)
      .eq("id", existing.id)
      .select("id,provider,base_url,model,encrypted_api_key,is_active,updated_at")
      .single();

    if (error) throw new Error(error.message);
    return data as StoredConfig;
  }

  const { data, error } = await admin
    .from("ai_provider_configs")
    .insert(payload)
    .select("id,provider,base_url,model,encrypted_api_key,is_active,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as StoredConfig;
}

export function maskApiKey(apiKey: string | null) {
  if (!apiKey) return "";
  if (apiKey.length <= 8) return "••••••••";
  return `${apiKey.slice(0, 4)}••••••••${apiKey.slice(-4)}`;
}
