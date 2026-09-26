import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccess } from "@/lib/billing/access";
import type { ResearchItem } from "@/lib/research/news";
import { discoverAcrossInterests, selectInterestAwareCandidates } from "@/lib/research/discovery";
import { generateEditorialAngles, generateEditorialPost } from "@/lib/ai/editorial";
import { verifySourceUrl } from "@/lib/research/verify-source";
import { normalizeInterests, type ContentInterest } from "@/lib/content-interests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&rsquo;|&#8217;|&#x2019;/gi, "’").replace(/&lsquo;|&#8216;|&#x2018;/gi, "‘")
    .replace(/&rdquo;|&#8221;|&#x201D;/gi, "”").replace(/&ldquo;|&#8220;|&#x201C;/gi, "“")
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&nbsp;/gi, " ");
}

function formatDate(value: string) {
  if (!value) return "Unknown date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(date);
}

function trimToCompleteSentences(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [];
  let result = "";
  for (const sentence of sentences) {
    const candidate = (result ? result + " " : "") + sentence.trim();
    if (candidate.length > maxLength) break;
    result = candidate;
  }

  if (result.length >= 60) return result;
  return text.slice(0, maxLength).replace(/\s+\S*$/, "").trim() + "…";
}

function createVisualCopy(
  generated: string,
  angle: string,
  sourceSummary: string,
  sourceTitle: string,
) {
  // Keep the LinkedIn post and the infographic complementary:
  // the post carries the editorial interpretation, while the visual carries
  // source-grounded facts. Do not copy the generated post or angle into the card.
  const summarySentences =
    sourceSummary.match(/[^.!?]+[.!?]+/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
  const points = summarySentences
    .slice(0, 3)
    .map((item) => trimToCompleteSentences(item, 150).replace(/[.!?]+$/, ""));

  return {
    headline: sourceTitle.trim(),
    body: "",
    points,
    takeaway: "",
  };
}

function getCandidateKey(item: ResearchItem) {
  return item.url.trim().toLowerCase().replace(/\/$/, "");
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "article processing failed.";
}

function getLocalScheduleParts(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
    minutesSinceMidnight: hour * 60 + minute,
  };
}

function isScheduleDue(localMinutes: number, publishTime: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(publishTime);
  if (!match) return false;

  const scheduledMinutes = Number(match[1]) * 60 + Number(match[2]);
  // The cron runs every 15 minutes. A small tolerance allows a delayed
  // invocation to execute without requiring an exact minute match.
  const elapsed = (localMinutes - scheduledMinutes + 24 * 60) % (24 * 60);
  return elapsed < 15;
}

async function buildDraft(interests: ContentInterest[]) {
  // Keep interactive regeneration comfortably inside the request budget.
  // Each candidate can require source verification plus two AI generations,
  // so processing ten candidates serially can easily exceed Vercel limits.
  const maxAttempts = 1;
  const maxCandidatesPerAttempt = 2;
  const errors: string[] = [];
  const attemptedUrls = new Set<string>();

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const discovery = await discoverAcrossInterests(interests);
      const candidates = selectInterestAwareCandidates(discovery.candidates, 24);

      for (const failure of discovery.failedInterests) {
        errors.push(`Attempt ${attempt}: ${failure.interest} discovery failed — ${failure.error}`);
      }

      const usableCandidates = candidates
        .filter((item) => item.title?.trim() && item.url?.trim() && item.snippet?.trim())
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

      const candidatesToProcess = usableCandidates
        .filter((item) => !attemptedUrls.has(getCandidateKey(item)))
        .slice(0, maxCandidatesPerAttempt);

      console.info(`[PostCraft] auto_discovery attempt=${attempt} candidates=${candidates.length} usable=${usableCandidates.length} new_candidates=${candidatesToProcess.length}`);

      if (!candidatesToProcess.length) errors.push(`Attempt ${attempt}: no new usable AI article candidates were returned.`);

      for (const candidate of candidatesToProcess) {
        const candidateKey = getCandidateKey(candidate);
        attemptedUrls.add(candidateKey);
        try {
          const verified = await verifySourceUrl(candidate.url);
          const verifiedSummary = verified.summary?.trim();
          const searchSummary = candidate.snippet?.trim();
          const story = {
            topic: interests.join(", "),
            headline: decodeHtmlEntities((verified.title && verified.title.trim().length > 8 && verified.title.trim().toLowerCase() !== "msn" ? verified.title : candidate.title) || candidate.title),
            source: verified.source || candidate.source,
            summary: verifiedSummary || searchSummary || "",
            url: verified.url || candidate.url,
          };

          const editorial = await generateEditorialAngles(story);
          const bestAngle = editorial.angles[0];
          if (!bestAngle) throw new Error("The selected article did not produce a sufficiently grounded angle.");

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
          const visual = createVisualCopy(generated.trim(), bestAngle.angle, story.summary, sourceTitle);

          return {
            ok: true as const,
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
            post: generated.trim(),
            visual: { ...visual, attribution },
            nextStep: "Review the prepared draft. LinkedIn unattended publishing remains disabled until the integration is validated.",
          };
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
  }

  return { ok: false as const, error: `Automatic discovery could not find and prepare a usable article after ${maxAttempts} attempts.`, attempts: maxAttempts, details: errors.slice(-8) };
}

async function reserveCronDraft(admin: ReturnType<typeof createAdminClient>, userId: string, draftDate: string) {
  const { error } = await admin.from("postcraft_daily_drafts").insert({
    user_id: userId,
    draft_date: draftDate,
    status: "generating",
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  throw error;
}

async function processScheduledUser(userId: string, mode: string, timezone: string, publishTime: string) {
  const admin = createAdminClient();
  const local = getLocalScheduleParts(timezone);

  const { data: preferences, error: preferencesError } = await admin
    .from("postcraft_user_preferences")
    .select("interests,interests_completed_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (preferencesError) {
    return { userId, status: "preferences_error", date: local.date };
  }

  const interests = normalizeInterests(preferences?.interests);
  if (!preferences?.interests_completed_at || !interests.length) {
    return { userId, status: "interests_required", date: local.date };
  }

  if (!isScheduleDue(local.minutesSinceMidnight, publishTime)) {
    return {
      userId,
      status: "not_due",
      date: local.date,
      localTime: local.time,
      preferredTime: publishTime,
      timezone,
    };
  }

  const { data: billing } = await admin.from("billing_subscriptions").select("status,trial_ends_at,grace_ends_at").eq("user_id", userId).maybeSingle();
  const now = Date.now();
  const allowed = billing?.status === "active" ||
    (billing?.status === "trialing" && billing.trial_ends_at && new Date(billing.trial_ends_at).getTime() > now) ||
    (billing?.status === "grace" && billing.grace_ends_at && new Date(billing.grace_ends_at).getTime() > now);
  if (!allowed) return { userId, status: "billing_blocked", date: local.date };

  const reserved = await reserveCronDraft(admin, userId, local.date);
  if (!reserved) return { userId, status: "already_processed", date: local.date };

  const result = await buildDraft(interests);
  if (!result.ok) {
    await admin.from("postcraft_daily_drafts").update({
      status: "failed",
      error_message: result.error,
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId).eq("draft_date", local.date);
    return { userId, status: "failed", date: local.date, error: result.error };
  }

  await admin.from("postcraft_daily_drafts").update({
    status: "ready",
    source_url: result.article.url,
    source_title: result.article.title,
    source_name: result.article.source,
    generated_post: result.post,
    working_post: result.post,
    recommended_angle: result.angle?.angle || null,
    angle_why: result.angle?.why || null,
    ranking_reason: result.ranking?.reason || null,
    candidate_count: result.ranking?.candidateCount || null,
    verification_status: "verified",
    error_message: mode === "automatic" ? "Automatic LinkedIn publishing is held until the LinkedIn integration is validated." : null,
    updated_at: new Date().toISOString(),
  }).eq("user_id", userId).eq("draft_date", local.date);

  return { userId, status: "ready", date: local.date, mode, preferredTime: publishTime, linkedinPublish: "held" };
}

async function runAutomaticWorkflow(request: NextRequest, userId?: string) {
  if (userId) {
    const admin = createAdminClient();
    const { data: preferences, error: preferencesError } = await admin
      .from("postcraft_user_preferences")
      .select("interests,interests_completed_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (preferencesError) throw preferencesError;

    const interests = normalizeInterests(preferences?.interests);
    if (!preferences?.interests_completed_at || !interests.length) {
      return NextResponse.json(
        { error: "Choose your areas of interest before generating personalized content.", code: "INTERESTS_REQUIRED" },
        { status: 428 },
      );
    }

    const result = await buildDraft(interests);
    if (!result.ok) return NextResponse.json(result, { status: 503 });
    return NextResponse.json({ ...result, interests });
  }

  const admin = createAdminClient();
  const { data: schedules, error } = await admin.from("postcraft_schedules").select("user_id,mode,timezone,publish_time").eq("enabled", true);
  if (error) throw error;

  const results = [];
  for (const schedule of schedules || []) {
    results.push(await processScheduledUser(schedule.user_id, schedule.mode, schedule.timezone, schedule.publish_time));
  }

  return NextResponse.json({
    ok: true,
    processed: results,
    message: "Scheduled automation checked using each user's selected interests. LinkedIn unattended publishing remains held until the integration is validated.",
  });
}

export async function POST(request: NextRequest) {
  try {
    const billing = await getBillingAccess();
    if (!billing.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!billing.allowed) return NextResponse.json({ error: "Start your free trial or subscribe to continue", billingStatus: billing.status }, { status: 402 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    // The selected-interest profile is the source of truth. The legacy topic
    // field is intentionally ignored so one hard-coded feed cannot bypass it.
    await request.json().catch(() => ({}));

    return await runAutomaticWorkflow(request, user.id);
  } catch (error) {
    console.error("Automatic publishing run failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automatic publishing run failed." }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  try {
    return await runAutomaticWorkflow(request);
  } catch (error) {
    console.error("Automatic publishing cron failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automatic publishing cron failed." }, { status: 500 });
  }
}
