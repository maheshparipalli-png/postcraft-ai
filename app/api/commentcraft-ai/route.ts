import { NextResponse } from "next/server";

const ALLOWED_ACTIONS = new Set(["generate", "suggest", "refine", "summarize"]);

export async function POST(request: Request) {
  try {
    // CommentCraft AI lives in the dedicated Supabase project, not the PostCraft
    // database project. Prefer explicit Comment-specific environment variables,
    // with a safe publishable-key fallback so the route works without another
    // Vercel secret configuration step.
    const supabaseUrl =
      process.env.COMMENT_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_COMMENT_SUPABASE_URL ||
      "https://usuklfeqniydrpxzisxv.supabase.co";
    const anonKey =
      process.env.COMMENT_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_COMMENT_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_COMMENT_SUPABASE_PUBLISHABLE_KEY ||
      "sb_publishable_VWYDQTZLiGwUCMz_FQZbvg_2PO0FxLu";

    const body = await request.json();
    if (!body?.action || !ALLOWED_ACTIONS.has(body.action)) {
      return NextResponse.json({ error: "Invalid Comment AI action." }, { status: 400 });
    }

    const endpoint = `${supabaseUrl.replace(/\/$/, "")}/functions/v1/commentcraft-ai`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const text = await response.text();
    let data: unknown = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || "The Comment AI service returned an invalid response." };
    }

    if (!response.ok) {
      const error =
        typeof data === "object" &&
        data !== null &&
        "error" in data &&
        typeof data.error === "string"
          ? data.error
          : `Comment AI request failed with status ${response.status}.`;

      return NextResponse.json({ error }, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Comment AI proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach the Comment AI service." },
      { status: 502 }
    );
  }
}
