import { NextResponse } from "next/server";
import { getBillingAccess } from "@/lib/billing/access";
import { generateAIImage } from "@/lib/ai/image";
import { httpStatusForAIError, userFacingAIError } from "@/lib/ai/errors";
import { createClient } from "@/lib/supabase/server";
import { persistGeneratedImage } from "@/lib/postcard/image-storage";

export const maxDuration = 300;

export async function POST(request: Request) {
  const access = await getBillingAccess();
  if (!access.allowed) {
    return NextResponse.json(
      {
        error: access.authenticated
          ? "An active PostCraft subscription or trial is required for image generation."
          : "Sign in to generate images.",
      },
      { status: access.authenticated ? 402 : 401 },
    );
  }

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const model = typeof body?.model === "string" ? body.model.trim() : undefined;
    const width = typeof body?.width === "number" ? body.width : undefined;
    const height = typeof body?.height === "number" ? body.height : undefined;

    const result = await generateAIImage(prompt, {
      model,
      width,
      height,
      numImages: 1,
    });

    const storedImages = await Promise.all(
      result.images.map((image) => persistGeneratedImage({ userId: user.id, image })),
    );

    return NextResponse.json(
      {
        ok: true,
        provider: result.provider,
        model: result.model,
        images: storedImages.map((image) => ({
          url: image.url,
          storagePath: image.storagePath,
          mimeType: image.mimeType,
          size: image.size,
        })),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    console.error("[PostCraft] image generation failed", {
      kind: error && typeof error === "object" && "kind" in error
        ? String((error as { kind?: unknown }).kind)
        : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: userFacingAIError(error) },
      { status: httpStatusForAIError(error) },
    );
  }
}
