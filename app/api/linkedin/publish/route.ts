import { NextRequest, NextResponse } from "next/server";
import { decryptLinkedInSession, linkedinCookieName } from "@/lib/linkedin";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "node:crypto";

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get(linkedinCookieName())?.value;
    const session = cookie ? decryptLinkedInSession(cookie) : null;
    if (!session) return NextResponse.json({ error: "Connect your LinkedIn account first." }, { status: 401 });

    const body = await request.json();
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : null;
    const sourceTitle = typeof body?.sourceTitle === "string" ? body.sourceTitle.trim() : null;
    const commentary = typeof body?.commentary === "string" ? body.commentary.trim() : "";
    if (!commentary) return NextResponse.json({ error: "There is no post to publish." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

    const normalizeUrl = (value: string | null) => {
      if (!value) return null;
      try {
        const url = new URL(value);
        url.hash = "";
        ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
        url.search = url.searchParams.toString();
        return url.toString().replace(/\/$/, "");
      } catch { return value.trim().replace(/\/$/, ""); }
    };
    const normalizedSourceUrl = normalizeUrl(sourceUrl);
    const contentHash = createHash("sha256").update(commentary.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");

    const { data: existing } = await supabase
      .from("postcraft_publications")
      .select("id, linkedin_post_id")
      .eq("user_id", user.id)
      .or(`content_hash.eq.${contentHash}${normalizedSourceUrl ? `,source_url.eq.${normalizedSourceUrl}` : ""}`)
      .limit(1);
    if (existing?.length) {
      return NextResponse.json({ error: "Duplicate content detected. This article or a substantially identical post has already been published." }, { status: 409 });
    }

    const response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
        "Linkedin-Version": process.env.LINKEDIN_VERSION || "202601",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
        author: session.personUrn,
        commentary,
        visibility: "PUBLIC",
        distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
        lifecycleState: "PUBLISHED",
        isReshareDisabledByAuthor: false,
      }),
    });
    const responseText = await response.text();
    if (!response.ok) {
      let detail = responseText;
      try { detail = JSON.parse(responseText)?.message || detail; } catch { /* plain text */ }
      return NextResponse.json({ error: `LinkedIn publishing failed: ${detail}` }, { status: response.status });
    }
    const linkedinPostId = response.headers.get("x-restli-id") || null;
    const { error: historyError } = await supabase.from("postcraft_publications").insert({
      user_id: user.id,
      linkedin_post_id: linkedinPostId,
      source_url: normalizedSourceUrl,
      source_title: sourceTitle,
      post_text: commentary,
      content_hash: contentHash,
      published_at: new Date().toISOString(),
    });
    if (historyError) console.error("Could not save publication history:", historyError);
    return NextResponse.json({ ok: true, id: linkedinPostId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not publish to LinkedIn." }, { status: 500 });
  }
}
