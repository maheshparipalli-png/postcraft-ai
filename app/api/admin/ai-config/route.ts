import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin/access";
import {
  getPublicAIConfig,
  getRuntimeAIConfig,
  saveAIConfig,
  type AIProviderName,
} from "@/lib/ai/config";
import { createOpenAICompatibleProvider } from "@/lib/ai/openai-compatible";
import { createAnthropicProvider } from "@/lib/ai/anthropic";
import { createOllamaProvider } from "@/lib/ai/ollama";

const providers: AIProviderName[] = ["ollama", "freellmapi", "openai", "anthropic", "google", "custom"];

type AIConfigRequest = {
  provider?: unknown;
  model?: unknown;
  baseUrl?: unknown;
  apiKey?: unknown;
};

function validateInput(body: AIConfigRequest) {
  const provider = typeof body.provider === "string" ? body.provider as AIProviderName : undefined;
  const model = typeof body.model === "string" ? body.model.trim() : "";
  const rawBaseUrl = typeof body.baseUrl === "string" ? body.baseUrl.trim() : "";

  if (!provider || !providers.includes(provider)) throw new Error("Invalid AI provider.");
  if (!model) throw new Error("Model is required.");

  if (provider !== "ollama" && provider !== "anthropic" && !rawBaseUrl) {
    throw new Error("Base URL is required for this provider.");
  }

  const baseUrl = provider === "ollama" ? null : rawBaseUrl || null;

  if (baseUrl) {
    let parsed: URL;
    try {
      parsed = new URL(baseUrl);
    } catch {
      throw new Error("Base URL must be a valid URL.");
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("Base URL must start with http:// or https://");
    }
  }

  return {
    provider,
    model,
    baseUrl,
    apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
  };
}

export async function GET() {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const config = await getPublicAIConfig();
  return NextResponse.json({ config });
}

export async function POST(request: Request) {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  try {
    const body = await request.json() as unknown;
    if (!body || typeof body !== "object") throw new Error("Invalid request body.");

    const input = validateInput(body as AIConfigRequest);
    const existing = await getPublicAIConfig();

    if (
      input.provider !== "ollama" &&
      !input.apiKey &&
      !(existing?.provider === input.provider && existing.apiKeyConfigured)
    ) {
      throw new Error("API key is required when configuring or switching to this provider.");
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
        apiKeyConfigured: Boolean(saved.encrypted_api_key),
        isActive: saved.is_active,
        updatedAt: saved.updated_at,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save AI configuration." },
      { status: 400 },
    );
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
      provider = createOllamaProvider({ baseUrl: undefined, model: input.model });
    } else {
      const runtime = await getRuntimeAIConfig();
      const apiKey = input.apiKey || (runtime?.provider === input.provider ? runtime.apiKey : null) || "";
      if (!apiKey) throw new Error("API key is required to test this provider.");

      if (input.provider === "anthropic") {
        provider = createAnthropicProvider({
          baseUrl: input.baseUrl,
          apiKey,
          model: input.model,
        });
      } else {
        provider = createOpenAICompatibleProvider({
          baseUrl: input.baseUrl!,
          apiKey,
          model: input.model,
          supportsResponseFormat: input.provider !== "freellmapi",
          providerLabel:
            input.provider === "freellmapi"
              ? "FreeLLMAPI"
              : input.provider === "openai"
                ? "OpenAI"
                : input.provider === "google"
                  ? "Google"
                  : "Custom provider",
        });
      }
    }

    const startedAt = Date.now();
    const result = await provider.generateText(
      "Reply with exactly: PostCraft AI connection works.",
      { temperature: 0, numPredict: 40 },
    );

    return NextResponse.json({
      ok: true,
      response: result,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI connection test failed." },
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
