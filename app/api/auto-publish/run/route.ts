import { NextRequest, NextResponse } from "next/server";
import { searchNews, type ResearchItem } from "@/lib/research/news";
import { generateEditorialAngles, generateEditorialPost } from "@/lib/ai/editorial";
import { verifySourceUrl } from "@/lib/research/verify-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function formatDate(value: string) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata",
  }).format(date);
}

async function verifySource(item: ResearchItem) {
  return verifySourceUrl(item.url);
}

async function pause(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runAutomaticWorkflow(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" && body.topic.trim()
    ? body.topic.trim() : "AI & Technology";

  if (topic !== "AI & Technology") {
    return NextResponse.json({ error: "Automatic publishing is currently restricted to the AI & Technology feed." }, { status: 400 });
  }

  // Discovery can fail temporarily because a feed, source-verification provider,
  // or AI provider may return an empty or incomplete response. Retry a bounded
  // number of times rather than failing after the first transient problem.
  const maxAttempts = 2;
  const errors: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const candidates = await searchNews("AI & Technology");
      const usableCandidates = candidates.filter(
        (item) => item.title?.trim() && item.url?.trim() && item.snippet?.trim(),
      );

      const firstArticle = usableCandidates[0];

      if (!firstArticle) {
        errors.push(`Attempt ${attempt}: no usable AI article was returned.`);
      } else {
        try {
          const verified = await verifySource(firstArticle);
          const story = {
            topic: "AI & Technology",
            headline: decodeHtmlEntities((verified.title && verified.title.trim().length > 8 && verified.title.trim().toLowerCase() !== "msn" ? verified.title : firstArticle.title) || firstArticle.title),
            source: verified.source || firstArticle.source,
            summary: firstArticle.snippet,
            url: verified.url || firstArticle.url,
          };

          const editorial = await generateEditorialAngles(story);
          const bestAngle = editorial.angles[0];
          if (!bestAngle) {
            throw new Error("The selected article did not produce a sufficiently grounded angle.");
          }

          const generated = await generateEditorialPost(
            story, bestAngle.angle, bestAngle.why,
            "Write the strongest natural version of the selected thesis. Use plain language and a clear point of view.",
            editorial.evidence,
          );

          const sourceTitle = decodeHtmlEntities(story.headline.trim());
          const sourcePublication = story.source.trim() || "the original publisher";
          const sourceDate = formatDate(verified.publishedAt || firstArticle.publishedAt);
          const attribution = `This post is based on an article published by ${sourcePublication} on ${sourceDate}, titled "${sourceTitle}".`;

          return NextResponse.json({
            ok: true,
            status: "draft_ready",
            attempts: attempt,
            article: { title: sourceTitle, source: sourcePublication, publishedAt: verified.publishedAt || firstArticle.publishedAt, url: story.url, content: firstArticle.snippet },
            ranking: { selectedRank: 1, candidateCount: candidates.length, reason: `Selected as the highest-ranked usable AI story from ${candidates.length} candidates. The recommendation favors a timely, credible development with a clear insight, practical relevance, and a perspective that can be understood by a broad professional audience.` },
            angle: bestAngle,
            post: `${attribution}\n\n${generated.trim()}`,
            nextStep: "Connect persistent scheduling and server-side LinkedIn authorization before enabling unattended publication.",
          });
        } catch (error) {
          errors.push(`Attempt ${attempt}: ${error instanceof Error ? error.message : "article processing failed."}`);
        }
      }
    } catch (error) {
      errors.push(`Attempt ${attempt}: ${error instanceof Error ? error.message : "discovery failed."}`);
    }

    if (attempt < maxAttempts) {
      await pause(700 * attempt);
    }
  }

  return NextResponse.json({
    error: `Automatic discovery could not find and prepare a usable article after ${maxAttempts} attempts.`,
    attempts: maxAttempts,
    details: errors.slice(-5),
  }, { status: 503 });
}

export async function POST(request: NextRequest) {
  try { return await runAutomaticWorkflow(request); }
  catch (error) {
    console.error("Automatic publishing run failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automatic publishing run failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }
  try { return await runAutomaticWorkflow(request); }
  catch (error) {
    console.error("Automatic publishing cron failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automatic publishing cron failed." }, { status: 500 });
  }
}
