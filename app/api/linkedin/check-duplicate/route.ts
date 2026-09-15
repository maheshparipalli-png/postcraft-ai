import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

function normalizeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
    url.search = url.searchParams.toString();
    return url.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const commentary = typeof body?.commentary === "string" ? body.commentary.trim() : "";
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : null;
    if (!commentary) return NextResponse.json({ duplicate: false, message: "Nothing to check yet." });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

    const contentHash = createHash("sha256").update(commentary.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
    const normalizedSourceUrl = normalizeUrl(sourceUrl);
    const query = supabase.from("postcraft_publications").select("id").eq("user_id", user.id);
    const { data: byHash, error: hashError } = await query.eq("content_hash", contentHash).limit(1);
    if (hashError) throw hashError;
    if (byHash?.length) return NextResponse.json({ duplicate: true, message: "An identical post has already been published." });

    if (normalizedSourceUrl) {
      const { data: bySource, error: sourceError } = await supabase.from("postcraft_publications").select("id").eq("user_id", user.id).eq("source_url", normalizedSourceUrl).limit(1);
      if (sourceError) throw sourceError;
      if (bySource?.length) return NextResponse.json({ duplicate: true, message: "This source article has already been used in a published post." });
    }

    return NextResponse.json({ duplicate: false, message: "No matching published article or identical post was found." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not complete the originality check." }, { status: 500 });
  }
}
