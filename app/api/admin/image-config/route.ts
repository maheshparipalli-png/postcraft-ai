import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin/access";
import {
  getPublicImageConfigs,
  saveImageProviderConfig,
  type AIImageProviderName,
} from "@/lib/ai/image-config";

const providers: AIImageProviderName[] = ["freellmapi", "openai"];

function validate(body: Record<string, unknown>) {
  const provider = typeof body.provider === "string" ? body.provider as AIImageProviderName : undefined;
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const baseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";
  const priority = typeof body.priority === "number" ? body.priority : 100;
  const isEnabled = body.isEnabled !== false;

  if (!provider || !providers.includes(provider)) throw new Error("Invalid image provider.");
  if (!model) throw new Error("Image model is required.");
  if (!Number.isInteger(priority) || priority < 1 || priority > 999) throw new Error("Priority must be a whole number from 1 to 999.");

  if (baseUrl) {
    let parsed: URL;
    try { parsed = new URL(baseUrl); } catch { throw new Error("Base URL must be a valid URL."); }
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Base URL must start with http:// or https://");
  }

  if (provider === "freellmapi" && !model.startsWith("@cf/")) {
    throw new Error("FreeLLMAPI image models must use a Cloudflare Workers AI model ID such as @cf/...");
  }

  return {
    provider,
    model,
    baseUrl: provider === "openai" ? (baseUrl || "https://api.openai.com/v1") : (baseUrl || null),
    apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
    priority,
    isEnabled,
  };
}

export async function GET() {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return NextResponse.json({ configs: await getPublicImageConfigs() });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const body = await request.json();
    if (!body || typeof body !== "object") throw new Error("Invalid request body.");
    const input = validate(body as Record<string, unknown>);

    const existing = (await getPublicImageConfigs()).find((item) => item.provider === input.provider);
    if (!input.apiKey && !existing?.apiKeyConfigured) {
      throw new Error("API key is required when configuring an image provider.");
    }

    const saved = await saveImageProviderConfig(input);
    await adminAudit(access.user!.id, "ai_image_config_updated", {
      provider: saved.provider,
      model: saved.model,
      priority: saved.priority,
      is_enabled: saved.is_enabled,
    });

    return NextResponse.json({
      ok: true,
      config: {
        id: saved.id,
        provider: saved.provider,
        baseUrl: saved.base_url,
        model: saved.model,
        apiKeyConfigured: Boolean(saved.encrypted_api_key),
        priority: saved.priority,
        isEnabled: saved.is_enabled,
        updatedAt: saved.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save image configuration." },
      { status: 400 },
    );
  }
}

async function adminAudit(adminUserId: string, action: string, metadata: Record<string, unknown>) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  await createAdminClient().from("admin_audit_logs").insert({
    admin_user_id: adminUserId,
    action,
    metadata,
  });
}
