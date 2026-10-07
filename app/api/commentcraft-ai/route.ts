import { NextResponse } from "next/server";

const ALLOWED_ACTIONS = new Set(["generate", "suggest", "refine", "summarize"]);
const MAX_BODY_BYTES = 8_000_000;
const MAX_POST_CHARS = 60_000;
const MAX_OTHER_TEXT_CHARS = 10_000;
const MAX_ATTACHMENT_CHARS = 7_000_000;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? "0");
    if (contentLength > MAX_BODY_BYTES) return errorResponse("Request is too large. Please reduce the attachment size.", 413);

    const supabaseUrl = process.env.COMMENT_SUPABASE_URL || process.env.NEXT_PUBLIC_COMMENT_SUPABASE_URL;
    const anonKey = process.env.COMMENT_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_COMMENT_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_COMMENT_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !anonKey) {
      console.error("Comment AI configuration is missing.");
      return errorResponse("Comment AI is not configured on the server.", 500);
    }

    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return errorResponse("Invalid request body.", 400);
    if (!body.action || !ALLOWED_ACTIONS.has(body.action)) return errorResponse("Invalid Comment AI action.", 400);

    const textFields = ["post", "content_url", "comment", "instruction", "file_name"];
    for (const field of textFields) {
      const value = body[field];
      if (value !== undefined && (typeof value !== "string" || value.length > (field === "post" ? MAX_POST_CHARS : MAX_OTHER_TEXT_CHARS))) {
        return errorResponse("One or more text fields are invalid or too long.", 400);
      }
    }

    for (const field of ["image_base64", "file_base64"]) {
      const value = body[field];
      if (value !== undefined && (typeof value !== "string" || value.length > MAX_ATTACHMENT_CHARS)) {
        return errorResponse("Attachment is too large.", 413);
      }
    }

    if (body.count !== undefined && (!Number.isInteger(body.count) || body.count < 1 || body.count > 5)) {
      return errorResponse("Comment count must be between 1 and 5.", 400);
    }

    if (body.styles !== undefined && (!Array.isArray(body.styles) || body.styles.length > 8 || body.styles.some((style: unknown) => typeof style !== "string" || style.length > 80))) {
      return errorResponse("Invalid comment styles.", 400);
    }

    if (body.keywords !== undefined && (!Array.isArray(body.keywords) || body.keywords.length > 20 || body.keywords.some((keyword: unknown) => typeof keyword !== "string" || keyword.length > 100))) {
      return errorResponse("Invalid keywords.", 400);
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
      const error = typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
        ? data.error
        : `Comment AI request failed with status ${response.status}.`;
      return NextResponse.json({ error }, { status: response.status });
    }

    return NextResponse.json(data, {
      headers: response.headers.get("x-request-id") ? { "X-Request-ID": response.headers.get("x-request-id")! } : undefined,
    });
  } catch (error) {
    console.error("Comment AI proxy error:", error);
    return errorResponse(error instanceof Error ? error.message : "Unable to reach the Comment AI service.", 502);
  }
}
