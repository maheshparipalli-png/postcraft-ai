import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin/access";
import { getRuntimeAIConfig } from "@/lib/ai/config";
import { getRuntimeImageConfigs } from "@/lib/ai/image-config";
import { getVerifiedImageModels, normalizeModelList } from "@/lib/ai/model-catalog";

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

async function fetchModels(baseUrl: string, apiKey: string | null, provider: string) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/models`, {
    headers: {
      Accept: "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${provider} model discovery failed (${response.status}).`);
  }

  let data: unknown;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`${provider} returned an invalid model catalogue.`);
  }

  return normalizeModelList(data);
}

export async function GET() {
  const access = await getAdminAccess();
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const textConfig = await getRuntimeAIConfig();
  const textModels: Array<{ id: string; provider: string; source: string }> = [];
  const discoveryErrors: string[] = [];

  if (textConfig?.baseUrl) {
    try {
      const ids = await fetchModels(textConfig.baseUrl, textConfig.apiKey, textConfig.provider);
      for (const id of ids) textModels.push({ id, provider: textConfig.provider, source: "live" });
    } catch (error) {
      discoveryErrors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const imageModels = new Map<string, {
    id: string;
    name: string;
    provider: string;
    source: string;
    verified: boolean;
  }>();

  // Inventory the verified catalog even before a provider is configured.
  for (const provider of ["freellmapi", "openai"] as const) {
    for (const model of getVerifiedImageModels(provider)) {
      imageModels.set(`${model.provider}:${model.id}`, {
        id: model.id,
        name: model.name,
        provider: model.provider,
        source: model.source,
        verified: model.verified,
      });
    }
  }

  return NextResponse.json({
    textModels,
    imageModels: [...imageModels.values()],
    discoveryErrors,
  });
}
