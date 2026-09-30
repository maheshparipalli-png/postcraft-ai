import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type AIImageProviderName = "freellmapi" | "openai";

export type AIImageProviderConfig = {
  id: string;
  provider: AIImageProviderName;
  baseUrl: string | null;
  model: string;
  apiKeyConfigured: boolean;
  priority: number;
  isEnabled: boolean;
  updatedAt: string;
};

type StoredImageConfig = {
  id: string;
  provider: AIImageProviderName;
  base_url: string | null;
  model: string;
  encrypted_api_key: string | null;
  priority: number;
  is_enabled: boolean;
  updated_at: string;
};

function getEncryptionKey() {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY?.trim();
  if (!secret) throw new Error("AI_CONFIG_ENCRYPTION_KEY is not configured.");
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
  if (!ivText || !tagText || !encryptedText) throw new Error("Stored image provider secret is invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

function publicConfig(config: StoredImageConfig): AIImageProviderConfig {
  return {
    id: config.id,
    provider: config.provider,
    baseUrl: config.base_url,
    model: config.model,
    apiKeyConfigured: Boolean(config.encrypted_api_key),
    priority: config.priority,
    isEnabled: config.is_enabled,
    updatedAt: config.updated_at,
  };
}

export async function getStoredImageConfigs(): Promise<StoredImageConfig[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_image_provider_configs")
    .select("id,provider,base_url,model,encrypted_api_key,priority,is_enabled,updated_at")
    .order("priority", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []) as StoredImageConfig[];
}

export async function getPublicImageConfigs() {
  return (await getStoredImageConfigs()).map(publicConfig);
}

export async function getRuntimeImageConfigs() {
  return (await getStoredImageConfigs())
    .filter((config): config is StoredImageConfig & { encrypted_api_key: string } => config.is_enabled && Boolean(config.encrypted_api_key))
    .map((config) => ({
      provider: config.provider,
      baseUrl: config.base_url,
      model: config.model,
      apiKey: decryptSecret(config.encrypted_api_key),
      priority: config.priority,
    }));
}

export async function saveImageProviderConfig(input: {
  provider: AIImageProviderName;
  baseUrl: string | null;
  model: string;
  apiKey?: string | null;
  priority: number;
  isEnabled: boolean;
}) {
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("ai_image_provider_configs")
    .select("id,encrypted_api_key")
    .eq("provider", input.provider)
    .maybeSingle();

  const apiKey = input.apiKey?.trim() || null;
  const payload = {
    provider: input.provider,
    base_url: input.baseUrl,
    model: input.model,
    priority: input.priority,
    is_enabled: input.isEnabled,
    updated_at: new Date().toISOString(),
    encrypted_api_key: apiKey
      ? encryptSecret(apiKey)
      : existing?.encrypted_api_key ?? null,
  };

  const query = existing?.id
    ? admin.from("ai_image_provider_configs").update(payload).eq("id", existing.id)
    : admin.from("ai_image_provider_configs").insert(payload);

  const { data, error } = await query
    .select("id,provider,base_url,model,encrypted_api_key,priority,is_enabled,updated_at")
    .single();

  if (error) throw new Error(error.message);
  return data as StoredImageConfig;
}
