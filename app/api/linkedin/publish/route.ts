import { NextRequest, NextResponse } from "next/server";
import { decryptLinkedInSession, linkedinCookieName } from "@/lib/linkedin";

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get(linkedinCookieName())?.value;
    const session = cookie ? decryptLinkedInSession(cookie) : null;
    if (!session) return NextResponse.json({ error: "Connect your LinkedIn account first." }, { status: 401 });

    const body = await request.json();
    const commentary = typeof body?.commentary === "string" ? body.commentary.trim() : "";
    if (!commentary) return NextResponse.json({ error: "There is no post to publish." }, { status: 400 });

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
    return NextResponse.json({ ok: true, id: response.headers.get("x-restli-id") || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not publish to LinkedIn." }, { status: 500 });
  }
}
