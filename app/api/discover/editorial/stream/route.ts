import { NextResponse } from "next/server";
import { getBillingAccess } from "@/lib/billing/access";
import { generateEditorialDraft } from "@/lib/ai/editorial";
import { verifySourceUrl, type VerifiedSource } from "@/lib/research/verify-source";

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

function canUseDiscoveryFallback(error: unknown, summary: string) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    summary.length >= 40 &&
    /could not be opened|returned HTTP (401|403|408|429|5\d\d)|timed out|timeout|fetch failed|network/i.test(
      message,
    )
  );
}

function event(controller: ReadableStreamDefaultController<Uint8Array>, encoder: TextEncoder, type: string, payload: unknown) {
  controller.enqueue(encoder.encode(JSON.stringify({ type, ...((payload && typeof payload === "object") ? payload : { value: payload }) }) + "\n"));
}

export async function POST(request: Request) {
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

  let verified: VerifiedSource | null = null;
  let sourceAccessFallback = false;

  try {
    try {
      verified = await verifySourceUrl(url);
    } catch (error) {
      if (!canUseDiscoveryFallback(error, fallbackSummary)) throw error;
      sourceAccessFallback = true;
      console.warn("Discover editorial stream source verification fallback:", {
        url,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const story = {
      topic: interest || "PostCraft",
      headline: decodeHtmlEntities(
        verified?.title?.trim().length && verified.title.trim().length > 8
          ? verified.title
          : fallbackTitle,
      ),
      source: verified?.source || fallbackSource || "the original publisher",
      summary: verified?.summary || fallbackSummary,
      url: verified?.url || url,
    };

    if (!story.headline || story.summary.length < 40) {
      return NextResponse.json(
        {
          error: sourceAccessFallback
            ? "The publisher blocked automated access and the discovery result did not contain enough article detail for a grounded editorial draft."
            : "PostCraft verified the source, but it did not expose enough article detail for a grounded editorial draft.",
        },
        { status: 422 },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          event(controller, encoder, "status", {
            message: "Source verified. Building the editorial angle…",
          });

          const editorial = await generateEditorialDraft(story, (token) => {
            event(controller, encoder, "token", { token });
          });

          event(controller, encoder, "done", {
            article: {
              title: story.headline,
              source: story.source,
              url: story.url,
              publishedAt: verified?.publishedAt || "",
              content: story.summary,
              sourceVerified: !sourceAccessFallback,
            },
            angle: editorial.selectedAngle,
            angles: editorial.angles,
            evidence: editorial.evidence,
            post: editorial.post,
            ranking: {
              reason: sourceAccessFallback
                ? "Selected story came from a direct publisher URL with sufficient discovery evidence; the publisher blocked automated verification, so the draft was grounded only in the discovery evidence."
                : "Selected story was verified at the original publisher, then processed through the same editorial pipeline as Auto-post.",
            },
            nextStep: "Review the source, angle, post and PostCard before publishing.",
          });

          controller.close();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not prepare the editorial draft.";
          console.error("Discover editorial stream API error:", error);
          event(controller, encoder, "error", { error: message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Discover editorial stream setup error:", error);
    const message = error instanceof Error ? error.message : "Could not prepare the editorial draft.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
