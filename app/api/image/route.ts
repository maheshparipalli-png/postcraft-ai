import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Image generation is not configured. Add OPENAI_API_KEY to your local environment." }, { status: 503 });
    }

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    if (prompt.length > 12000) return NextResponse.json({ error: "prompt is too long" }, { status: 400 });

    const model = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size: "1536x1024",
        quality: process.env.OPENAI_IMAGE_QUALITY ?? "medium",
        output_format: "png",
      }),
      signal: AbortSignal.timeout(120_000),
    });

    const data = await response.json();
    if (!response.ok) {
      const message = typeof data?.error?.message === "string" ? data.error.message : "OpenAI image generation failed";
      return NextResponse.json({ error: message }, { status: response.status >= 400 && response.status < 500 ? response.status : 502 });
    }

    const item = Array.isArray(data?.data) ? data.data[0] : null;
    if (typeof item?.b64_json === "string") {
      return NextResponse.json({ dataUrl: `data:image/png;base64,${item.b64_json}` });
    }
    if (typeof item?.url === "string") {
      return NextResponse.json({ url: item.url });
    }

    return NextResponse.json({ error: "OpenAI returned no image data" }, { status: 502 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Image generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
