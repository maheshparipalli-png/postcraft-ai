import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingAccess } from "@/lib/billing/access";
import { getAIProvider } from "@/lib/ai/provider";
import { POSTCARD_FIELD_TERMS, POSTCARD_FIELDS, type PostCardField } from "@/lib/postcard/categories";
import { parseJsonObject } from "@/lib/ai/json";
import { httpStatusForAIError, userFacingAIError } from "@/lib/ai/errors";
import { judgePostcardQuality } from "@/lib/postcard/quality";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type FeedItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
  sourceName: string;
};

const DEFAULT_FEEDS = [
  { name: "Tiny Buddha", url: "https://tinybuddha.com/feed/" },
  { name: "The Positivity Blog", url: "https://www.positivityblog.com/feed/" },
  { name: "Positive News", url: "https://www.positive.news/feed/" },
];

const CATEGORY_TERMS = POSTCARD_FIELD_TERMS;

const DEFAULT_CATEGORY: PostCardField = "resilience";

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(xml: string, tag: string) {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? decodeXml(match[1]) : "";
}

function parseFeed(xml: string, sourceName: string): FeedItem[] {
  const blocks = [
    ...Array.from(xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)).map((m) => m[0]),
    ...Array.from(xml.matchAll(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)).map((m) => m[0]),
  ];

  return blocks
    .map((block) => {
      const title = firstTag(block, "title");
      const linkTag = /<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i.exec(block);
      const hrefTag = /<link[^>]+href=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block);
      const link = decodeXml(hrefTag?.[1] || linkTag?.[1] || "");
      const summary = firstTag(block, "description") || firstTag(block, "summary") || firstTag(block, "content:encoded") || "";
      const published = firstTag(block, "pubDate") || firstTag(block, "published") || firstTag(block, "updated");
      const publishedDate = published ? new Date(published) : null;
      return {
        title: title.slice(0, 240),
        link,
        summary: summary.slice(0, 3500),
        publishedAt: publishedDate && !Number.isNaN(publishedDate.getTime()) ? publishedDate.toISOString() : null,
        sourceName,
      };
    })
    .filter((item) => item.title && /^https?:\/\//i.test(item.link));
}

function hashStory(item: FeedItem) {
  return createHash("sha256")
    .update((item.sourceName + "|" + item.link + "|" + item.title).toLowerCase().trim())
    .digest("hex");
}

function score(
  item: Pick<FeedItem, "title" | "summary"> | { source_title: string; source_summary: string },
  category: PostCardField,
) {
  const terms = CATEGORY_TERMS[category] ?? CATEGORY_TERMS[DEFAULT_CATEGORY];
  const title = "title" in item ? item.title : item.source_title;
  const summary = "summary" in item ? item.summary : item.source_summary;
  const text = (title + " " + summary).toLowerCase();
  return terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
}

async function fetchFeed(feed: { name: string; url: string }) {
  const response = await fetch(feed.url, {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "User-Agent": "PostCraft AI/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`${feed.name} returned HTTP ${response.status}.`);
  return parseFeed(await response.text(), feed.name);
}

const FEED_REFRESH_MS = 6 * 60 * 60 * 1000;

async function refreshPool(admin: ReturnType<typeof createAdminClient>) {
  const results = await Promise.allSettled(DEFAULT_FEEDS.map(fetchFeed));
  const items = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!items.length) return;

  const rows = items.map((item) => ({
    story_hash: hashStory(item),
    source_title: item.title,
    source_url: item.link,
    source_name: item.sourceName,
    source_summary: item.summary,
    source_published_at: item.publishedAt,
    category: POSTCARD_FIELDS
      .map((name) => ({ name, score: score(item, name) }))
      .sort((a, b) => b.score - a.score)[0]?.name || DEFAULT_CATEGORY,
  }));

  const { error } = await admin
    .from("postcard_story_pool")
    .upsert(rows, { onConflict: "story_hash" });

  if (error) console.error("PostCard story pool refresh failed:", error);
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const billing = await getBillingAccess();
    if (!billing.allowed) {
      return NextResponse.json({ error: "Start your free trial or subscribe to continue." }, { status: 402 });
    }

    const params = new URL(request.url).searchParams;
    const requestedCategory = params.get("category") || DEFAULT_CATEGORY;
    const category = POSTCARD_FIELDS.includes(requestedCategory as PostCardField) ? requestedCategory as PostCardField : DEFAULT_CATEGORY;
    const admin = createAdminClient();

    let { data: pool } = await admin
      .from("postcard_story_pool")
      .select("story_hash,source_title,source_url,source_name,source_summary,source_published_at,category,fetched_at")
      .order("fetched_at", { ascending: false })
      .limit(120);

    const latestFetchedAt = pool?.[0]?.fetched_at ? new Date(pool[0].fetched_at).getTime() : 0;
    if (!pool?.length || pool.length < 12 || !latestFetchedAt || Date.now() - latestFetchedAt > FEED_REFRESH_MS) {
      await refreshPool(admin);
      const refreshed = await admin
        .from("postcard_story_pool")
        .select("story_hash,source_title,source_url,source_name,source_summary,source_published_at,category,fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(120);
      pool = refreshed.data ?? [];
    }

    const hashes = (pool ?? []).map((item) => item.story_hash);
    const usageResult = hashes.length
      ? await admin
          .from("postcard_story_usage")
          .select("story_hash,cooldown_until")
          .eq("user_id", user.id)
          .in("story_hash", hashes)
      : { data: [] as { story_hash: string; cooldown_until: string }[] };

    const blocked = new Set(
      (usageResult.data ?? [])
        .filter((item) => new Date(item.cooldown_until).getTime() > Date.now())
        .map((item) => item.story_hash),
    );

    const candidates = (pool ?? [])
      .filter((item) => !blocked.has(item.story_hash))
      .map((item) => ({ item, score: score(item, category) }))
      .sort((a, b) => b.score - a.score);

    const top = candidates.slice(0, 12);
    const selected = top[Math.floor(Math.random() * top.length)]?.item;

    if (!selected) {
      return NextResponse.json({ error: "No fresh story sources are available right now. Try another field." }, { status: 404 });
    }

    const prompt = `You are PostCard's motivational story writer.

Turn the SOURCE MATERIAL below into a warm, original, easy-to-understand story for a social card and a fuller LinkedIn post.

The source is a creative starting point, not a fact-checking requirement. Preserve the central feeling or situation, but the final story may be simplified, imagined, metaphorical, or loosely inspired. Do not copy sentences or distinctive phrasing.

Create two related but deliberately different outputs. The postcard body should be 35-80 words. The LinkedIn post should be 80-180 words with a human hook, simple story or observation, and warm takeaway. The postcard must not copy or closely paraphrase the LinkedIn post. Keep both concrete, simple, warm, and human.

Category: ${category}

SOURCE:
Title: ${selected.source_title}
Source: ${selected.source_name}
URL: ${selected.source_url}
Summary:
${selected.source_summary || "(No summary supplied; use only the title and source context.)"}

Return ONLY valid JSON:
{
  "headline": "short story title, 4-9 words",
  "body": "35-80 word short postcard story",
  "closing": "one memorable lesson, 6-18 words",
  "linkedinPost": "80-180 word human LinkedIn story"
}

Do not add hashtags, emoji spam, citations, or markdown. Use simple everyday English and avoid AI meta-language.`;

    const provider = await getAIProvider();
    let best: { candidate: { headline: string; body: string; closing: string; linkedinPost: string }; quality: Awaited<ReturnType<typeof judgePostcardQuality>> } | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const attemptPrompt = attempt === 0
        ? prompt
        : prompt + "\n\nQUALITY RETRY " + attempt + ": The previous draft failed. Write a completely fresh version with simpler language, a more human voice, stronger emotional warmth, no repetition, and clear separation between postcard and LinkedIn post.";

      const raw = await provider.generateText(attemptPrompt, {
        temperature: attempt === 0 ? 0.82 : 0.9,
        numPredict: 900,
      });

      const generated = parseJsonObject(raw, "PostCard story AI");
      const candidate = {
        headline: typeof generated.headline === "string" ? generated.headline.trim() : "",
        body: typeof generated.body === "string" ? generated.body.trim() : "",
        closing: typeof generated.closing === "string" ? generated.closing.trim() : "",
        linkedinPost: typeof generated.linkedinPost === "string" ? generated.linkedinPost.trim() : "",
      };

      const quality = await judgePostcardQuality(candidate);
      if (!best || quality.score > best.quality.score) best = { candidate, quality };

      console.info("[PostCraft] story_quality", {
        attempt: attempt + 1,
        score: quality.score,
        pass: quality.pass,
        reasons: quality.reasons,
      });

      if (quality.pass) {
        best = { candidate, quality };
        break;
      }
    }

    if (!best || !best.quality.pass) {
      throw new Error("PostCard story could not meet the human-writing quality bar after three attempts. Please try again.");
    }

    const { candidate } = best;
    const bodyWords = candidate.body.split(/\s+/).filter(Boolean).length;
    const headlineWords = candidate.headline.split(/\s+/).filter(Boolean).length;
    const closingWords = candidate.closing.split(/\s+/).filter(Boolean).length;
    if (!candidate.headline || headlineWords < 3 || headlineWords > 12 ||
        bodyWords < 35 || bodyWords > 110 ||
        !candidate.closing || closingWords < 5 || closingWords > 24 ||
        !candidate.linkedinPost) {
      throw new Error("PostCard story generation returned content outside the required story format. Please try again.");
    }
    return NextResponse.json({
      story: {
        hash: selected.story_hash,
        title: candidate.headline,
        body: candidate.body,
        lesson: candidate.closing,
        linkedinPost: candidate.linkedinPost,
        category,
        sourceName: selected.source_name,
        sourceTitle: selected.source_title,
        sourceUrl: selected.source_url,
      },
    });
  } catch (error) {
    console.error("PostCard story generation failed:", {
      kind: error && typeof error === "object" && "kind" in error ? String((error as { kind?: unknown }).kind) : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: userFacingAIError(error) },
      { status: httpStatusForAIError(error) },
    );
  }
}
