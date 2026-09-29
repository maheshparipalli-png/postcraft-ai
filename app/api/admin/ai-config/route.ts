import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin/access";
import {
  getPublicAIConfig,
  getRuntimeAIConfig,
  maskApiKey,
  saveAIConfig,
  type AIProviderName,
} from "@/lib/ai/config";
import { createOpenAICompatibleProvider } from "@/lib/ai/openai-compatible";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { createOllamaProvider } from "@/lib/ai/ollama";

const providers: AIProviderName[] = ["ollama", "freellmapi", "openai", "anthropic", "google", "custom"];

function validateInput(body: any) {
  const provider = body?.provider as AIProviderName;
  const model = typeof body?.model === "string" ? body.model.trim() : "";
  const baseUrl = typeof body?.baseUrl === "string" ? body.baseUrl.trim() : "";

  if (!providers.includes(provider)) throw new Error("Invalid AI provider.");
  if (!model) throw new Error("Model is required.");

  if (provider !== "ollama" && !baseUrl && provider !== "anthropic") {
    throw new Error("Base URL is required for this provider.");
  }

  return {
    provider,
    model,
    baseUrl: baseUrl || null,
    apiKey: typeof body?.apiKey === "string" ? body.apiKey.trim() : "",
  };
}

export async function GET() {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const config = await getPublicAIConfig();
  return NextResponse.json({
    config: config ? { ...config, apiKey: config.apiKeyConfigured ? "configured" : "" } : null,
  });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const body = await request.json();
    const input = validateInput(body);
    const existing = await getRuntimeAIConfig();

    if (input.provider !== "ollama" && !input.apiKey && !existing?.apiKey) {
      throw new Error("API key is required for this provider.");
    }

    const saved = await saveAIConfig(input);

    await adminAudit(access.user!.id, "ai_config_updated", {
      provider: saved.provider,
      model: saved.model,
      base_url: saved.base_url,
    });

    return NextResponse.json({
      ok: true,
      config: {
        id: saved.id,
        provider: saved.provider,
        baseUrl: saved.base_url,
        model: saved.model,
        apiKey: saved.encrypted_api_key ? "configured" : "",
        isActive: saved.is_active,
        updatedAt: saved.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save AI configuration." }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const body = await request.json();
    const input = validateInput(body);

    let provider;
    if (input.provider === "ollama") {
      provider = createOllamaProvider({ baseUrl: input.baseUrl || undefined, model: input.model });
    } else {
      const runtime = await getRuntimeAIConfig();
      const apiKey = input.apiKey || runtime?.apiKey || "";
      if (!apiKey) throw new Error("API key is required to test this provider.");

      if (input.provider === "anthropic") {
        const anthropic = createAnthropicProvider({ baseUrl: input.baseUrl, apiKey, model: input.model });
        provider = anthropic;
      } else {
        const baseUrl = input.baseUrl!;
        provider = createOpenAICompatibleProvider({
          baseUrl,
          apiKey,
          model: input.model,
          providerLabel: input.provider === "freellmapi" ? "FreeLLMAPI" : input.provider === "openai" ? "OpenAI" : input.provider === "google" ? "Google" : "Custom provider",
        });
      }
    }

    const startedAt = Date.now();
    const result = await provider.generateText("Reply with exactly: PostCraft AI connection works.", { temperature: 0, numPredict: 40 });
    return NextResponse.json({ ok: true, response: result, elapsedMs: Date.now() - startedAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI connection test failed." }, { status: 400 });
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
