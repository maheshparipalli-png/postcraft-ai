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

function createVisualCopy(generated: string, angle: string) {
  const cleaned = generated
    .replace(/^\s*(this post|based on|read the original)[^\n]*\n?/i, "")
    .trim();
  const paragraphs = cleaned.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const body = (paragraphs[0] || cleaned).replace(/\s+/g, " ").trim();
  const sentence = body.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || body;
  const headline = sentence.length >= 35 && sentence.length <= 115
    ? sentence
    : angle.trim() || "AI safety cannot begin after the harm is done.";
  const supportingBody = body === headline ? (paragraphs[1] || body) : body;
  return {
    headline: headline.replace(/[.!?]+$/, ""),
    body: supportingBody.length > 260 ? `${supportingBody.slice(0, 257).trim()}…` : supportingBody,
  };
}

async function verifySource(item: ResearchItem) {
  return verifySourceUrl(item.url);
}

async function pause(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function getCandidateKey(item: ResearchItem) {
  return item.url.trim().toLowerCase().replace(/\/$/, "");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "article processing failed.";
}

async function runAutomaticWorkflow(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" && body.topic.trim()
    ? body.topic.trim() : "AI & Technology";

  if (topic !== "AI & Technology") {
    return NextResponse.json({ error: "Automatic publishing is currently restricted to the AI & Technology feed." }, { status: 400 });
  }

  const maxAttempts = 2;
  const maxCandidatesPerAttempt = 5;
  const errors: string[] = [];
  const attemptedUrls = new Set<string>();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const candidates = await searchNews("AI & Technology");
      const usableCandidates = candidates
        .filter(
          (item) => item.title?.trim() && item.url?.trim() && item.snippet?.trim(),
        )
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      const candidatesToProcess = usableCandidates
        .filter((item) => !attemptedUrls.has(getCandidateKey(item)))
        .slice(0, maxCandidatesPerAttempt);

      console.info(
        `[PostCraft] auto_discovery attempt=${attempt} candidates=${candidates.length} usable=${usableCandidates.length} new_candidates=${candidatesToProcess.length}`,
      );

      if (!candidatesToProcess.length) {
        errors.push(`Attempt ${attempt}: no new usable AI article candidates were returned.`);
      }

      for (const candidate of candidatesToProcess) {
        const candidateKey = getCandidateKey(candidate);
        attemptedUrls.add(candidateKey);

        try {
          console.info(`[PostCraft] auto_candidate attempt=${attempt} url=${candidate.url}`);

          const verified = await verifySource(candidate);
          const verifiedSummary = verified.summary?.trim();
          const searchSummary = candidate.snippet?.trim();
          const story = {
            topic: "AI & Technology",
            headline: decodeHtmlEntities(
              (verified.title && verified.title.trim().length > 8 && verified.title.trim().toLowerCase() !== "msn"
                ? verified.title
                : candidate.title) || candidate.title,
            ),
            source: verified.source || candidate.source,
            summary: verifiedSummary || searchSummary || "",
            url: verified.url || candidate.url,
          };

          console.info(
            `[PostCraft] auto_verified source=${story.source} summary_chars=${story.summary.length} published_at=${verified.publishedAt || candidate.publishedAt || "unknown"}`,
          );

          const editorial = await generateEditorialAngles(story);
          const bestAngle = editorial.angles[0];
          if (!bestAngle) {
            throw new Error("The selected article did not produce a sufficiently grounded angle.");
          }

          const generated = await generateEditorialPost(
            story,
            bestAngle.angle,
            bestAngle.why,
            "Write the strongest natural version of the selected thesis. Use plain language and a clear point of view.",
            editorial.evidence,
          );

          const sourceTitle = decodeHtmlEntities(story.headline.trim());
          const sourcePublication = story.source.trim() || "the original publisher";
          const sourceDate = formatDate(verified.publishedAt || candidate.publishedAt);
          const attribution = `Based on a ${sourcePublication} article, ${sourceDate}`;
          const visual = createVisualCopy(generated.trim(), bestAngle.angle);

          console.info(
            `[PostCraft] auto_candidate_success attempt=${attempt} url=${story.url} evidence=${editorial.evidence.length} angles=${editorial.angles.length}`,
          );

          return NextResponse.json({
            ok: true,
            status: "draft_ready",
            attempts: attempt,
            article: {
              title: sourceTitle,
              source: sourcePublication,
              publishedAt: verified.publishedAt || candidate.publishedAt,
              url: story.url,
              content: story.summary,
            },
            ranking: {
              selectedRank: usableCandidates.findIndex((item) => getCandidateKey(item) === candidateKey) + 1,
              candidateCount: candidates.length,
              reason: `Selected from ${usableCandidates.length} usable AI stories after source verification and editorial evidence checks.`,
            },
            angle: bestAngle,
            post: `${generated.trim()}\n\nRead the original article: ${story.url}`,
            visual: {
              ...visual,
              attribution,
            },
            nextStep: "Connect persistent scheduling and server-side LinkedIn authorization before enabling unattended publication.",
          });
        } catch (error) {
          const message = getErrorMessage(error);
          errors.push(`Attempt ${attempt}, candidate ${candidate.title}: ${message}`);
          console.warn(`[PostCraft] auto_candidate_rejected attempt=${attempt} url=${candidate.url} reason=${message}`);
        }
      }
    } catch (error) {
      const message = getErrorMessage(error);
      errors.push(`Attempt ${attempt}: ${message}`);
      console.error(`[PostCraft] auto_discovery_failed attempt=${attempt} reason=${message}`);
    }

    if (attempt < maxAttempts) await pause(700 * attempt);
  }

  return NextResponse.json({
    error: `Automatic discovery could not find and prepare a usable article after ${maxAttempts} attempts.`,
    attempts: maxAttempts,
    details: errors.slice(-8),
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
