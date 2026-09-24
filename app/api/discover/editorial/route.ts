import { NextResponse } from "next/server";
import { getBillingAccess } from "@/lib/billing/access";
import { generateEditorialDraft } from "@/lib/ai/editorial";
import { verifySourceUrl } from "@/lib/research/verify-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&rsquo;|&#8217;|&#x2019;/gi, "’")
    .replace(/&lsquo;|&#8216;|&#x2018;/gi, "‘")
    .replace(/&rdquo;|&#8221;|&#x201D;/gi, "”")
    .replace(/&ldquo;|&#8220;|&#x201C;/gi, "“")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ");
}

export async function POST(request: Request) {
  try {
    const access = await getBillingAccess();
    if (!access.authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json(
        {
          error:
            access.status === "billing_unavailable"
              ? "Unable to verify billing access"
              : "Start your free trial or subscribe to continue",
          billingStatus: access.status,
        },
        { status: access.status === "billing_unavailable" ? 500 : 402 },
      );
    }

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const fallbackTitle = typeof body?.title === "string" ? body.title.trim() : "";
    const fallbackSource = typeof body?.source === "string" ? body.source.trim() : "";
    const fallbackSummary = typeof body?.summary === "string" ? body.summary.trim() : "";
    const interest = typeof body?.interest === "string" ? body.interest.trim() : "";

    if (!url) {
      return NextResponse.json({ error: "The original source URL is required." }, { status: 400 });
    }

    const verified = await verifySourceUrl(url);
    const story = {
      topic: interest || "PostCraft",
      headline: decodeHtmlEntities(
        verified.title.trim().length > 8 ? verified.title : fallbackTitle,
      ),
      source: verified.source || fallbackSource || "the original publisher",
      summary: verified.summary || fallbackSummary,
      url: verified.url || url,
    };

    if (!story.headline || story.summary.length < 40) {
      return NextResponse.json(
        {
          error:
            "PostCraft verified the source, but it did not expose enough article detail for a grounded editorial draft.",
        },
        { status: 422 },
      );
    }

    const editorial = await generateEditorialDraft(story);

    return NextResponse.json({
      article: {
        title: story.headline,
        source: story.source,
        url: story.url,
        publishedAt: verified.publishedAt,
        content: story.summary,
      },
      angle: editorial.selectedAngle,
      angles: editorial.angles,
      evidence: editorial.evidence,
      post: editorial.post,
      ranking: {
        reason: "Selected story verified at the original publisher, then processed through the same editorial pipeline as Auto-post.",
      },
      nextStep: "Review the source, angle, post and PostCard before publishing.",
    });
  } catch (error) {
    console.error("Discover editorial API error:", error);
    const message =
      error instanceof Error ? error.message : "Could not prepare the editorial draft.";
    const status =
      message.includes("could not be opened") ||
      message.includes("source URL") ||
      message.includes("aggregator")
        ? 422
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
