import { NextResponse } from "next/server";
import { discoverAcrossInterests, selectInterestAwareCandidates } from "@/lib/research/discovery";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccess } from "@/lib/billing/access";
import { normalizeInterests } from "@/lib/content-interests";

function isAggregatorStory(source: string, url: string) {
  if (/^(google news|bing news|yahoo news)$/i.test(source.trim())) return true;
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\\./, "");
    return new Set(["news.google.com", "bing.com", "news.yahoo.com"]).has(hostname);
  } catch {
    return true;
  }
}

function getWhyItStandsOut(title: string, snippet: string, topic: string) {
  const text = `${title} ${snippet}`.toLowerCase();
  const hasEvidence = snippet.trim().length >= 80;

  if (!hasEvidence) {
    return "Not enough source detail is available to explain why this story deserves a strong point of view.";
  }

  if (topic === "PostCraft Recommended") {
    if (/\b(why|how|could|question|debate|risk|benefit|cost|impact|change)\b/i.test(title)) {
      return "It contains a clear tension or open question, with enough source detail to explore it without stretching beyond the reporting.";
    }
    if (/\b(policy|decision|investment|jobs|business|government|security|technology|science)\b/i.test(text)) {
      return "It connects a concrete development to a decision, trade-off, or consequence that can support a grounded point of view.";
    }
    return "It has enough concrete detail to build a specific point of view rather than simply repeat the headline.";
  }

  if (/\b(wipe out humanity|existential|hijack|misuse|safety|threat|danger|risk|harm)\b/.test(text)) {
    return "The useful question is how strong the reported risk is, what evidence supports it, and what the story actually establishes.";
  }

  if (/\b(govern|governance|trust|framework|enterprise|agent|accountab|compliance|responsib)\b/.test(text)) {
    return "The story gives us something concrete to examine about control, accountability, or how AI is being used in real workflows.";
  }

  if (/\b(model|launch|release|benchmark|reasoning|performance|training|inference|compute)\b/.test(text)) {
    return "The interesting part is what the reported capability or performance change means in practice, not just that a new model or release exists.";
  }

  if (/\b(job|work|employee|workplace|productivity|automation|labour|labor)\b/.test(text)) {
    return "The story gives us a concrete starting point for examining which work may change, what remains difficult, and who is affected.";
  }

  if (/\b(policy|law|regulation|government|legislation|court|ban|rule)\b/.test(text)) {
    return "The development can be examined through the actual policy decision and the trade-offs or consequences described by the source.";
  }

  if (/\b(robot|robotics|autonomous|self-driving|device|hardware|chip|semiconductor)\b/.test(text)) {
    return "The useful angle is the gap between what the technology can now do and what it can reliably do in practice.";
  }

  const subject = title.trim().replace(/\s+-\s+[^-]+$/, "");
  return `The story gives us a specific development to examine: “${subject}”. The strongest angle should stay close to what the source actually reports.`;
}

export async function POST(request: Request) {
  try {
    const access = await getBillingAccess();
    if (!access.authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.status === "billing_unavailable" ? "Unable to verify billing access" : "Start your free trial or subscribe to continue", billingStatus: access.status },
        { status: access.status === "billing_unavailable" ? 500 : 402 },
      );
    }

    const body = await request.json();
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "Personalized";


    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: preferences, error: preferencesError } = await supabase
      .from("postcraft_user_preferences")
      .select("interests,interests_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (preferencesError) throw preferencesError;

    const interests = normalizeInterests(preferences?.interests);
    if (!preferences?.interests_completed_at || !interests.length) {
      return NextResponse.json(
        { error: "Choose your areas of interest before PostCraft discovers content.", code: "INTERESTS_REQUIRED" },
        { status: 428 },
      );
    }

    const { candidates, failedInterests } = await discoverAcrossInterests(interests);
    const research = selectInterestAwareCandidates(candidates, 12);

    const normalizeUrl = (value: string) => {
      try {
        const url = new URL(value);
        url.hash = "";
        ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
        url.search = url.searchParams.toString();
        return url.toString().replace(/\/$/, "");
      } catch { return value.trim().replace(/\/$/, ""); }
    };
    let publishedUrls = new Set<string>();
    if (user) {
      const { data: history } = await supabase.from("postcraft_publications").select("source_url").eq("user_id", user.id);
      publishedUrls = new Set((history || []).map((row) => normalizeUrl(row.source_url)).filter(Boolean));
    }

    if (!research.length) {
      const partialFailure = failedInterests.length > 0;
      return NextResponse.json(
        {
          error: partialFailure
            ? "PostCraft could not retrieve usable stories from your selected content sources right now. Please retry in a moment."
            : "PostCraft could not find enough high-value stories across your selected interests today. Try adding another interest.",
          code: partialFailure ? "DISCOVERY_SOURCES_UNAVAILABLE" : "NO_STORIES_FOUND",
          interests,
          failedInterests,
        },
        { status: partialFailure ? 502 : 404 },
      );
    }

    const usableResearch = research.filter((item) =>
      !publishedUrls.has(normalizeUrl(item.url)) &&
      !isAggregatorStory(item.source, item.url) &&
      Boolean(item.title?.trim()) &&
      Boolean(item.source?.trim()) &&
      Boolean(item.url?.trim()) &&
      Boolean(item.snippet?.trim()) &&
      item.snippet.trim().length >= 80
    );

    if (!usableResearch.length) {
      return NextResponse.json(
        {
          error: "PostCraft found stories, but none met the evidence and quality threshold. No low-value filler was added.",
          code: "NO_HIGH_VALUE_STORIES",
          candidateCount: research.length,
          interests,
        },
        { status: 422 },
      );
    }

    const ideas = usableResearch.slice(0, Math.min(8, usableResearch.length)).map((item, index) => ({
      title: item.title,
      description: item.snippet,
      whyItMatters: getWhyItStandsOut(item.title, item.snippet, item.interest),
      sourceIndexes: [index],
      interest: item.interest,
      source: item.source,
      url: item.url,
      imageUrl: item.imageUrl || null,
      publishedAt: item.publishedAt,
    }));

    return NextResponse.json({ count: usableResearch.length, ideas, interests, failedInterests, selectedBy: "interest coverage + editorial quality ranking" });
  } catch (error) {
    console.error("Discover API error:", error);
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : error && typeof error === "object"
            ? JSON.stringify(error)
            : "Discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
