import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    if (prompt.length > 12000) {
      return NextResponse.json(
        { error: "prompt is too long" },
        { status: 400 }
      );
    }

    const text = await getAIProvider().generateText(prompt);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
