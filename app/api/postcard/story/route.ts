import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingAccess } from "@/lib/billing/access";
import { getAIProvider } from "@/lib/ai/provider";
import { POSTCARD_FIELD_TERMS, POSTCARD_FIELDS, type PostCardField } from "@/lib/postcard/categories";

export const dynamic = "force-dynamic";

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
  category: string,
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
    category: Object.keys(CATEGORY_TERMS)
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

Turn the SOURCE MATERIAL below into an original, short motivational story for a social card.

The source is the creative foundation. Preserve at least two concrete elements from it: the central situation, action, challenge, setting, subject, or lesson. Do not replace the source situation with a generic motivational scenario. If it describes a real person or event, do not invent facts. If it is a personal or fictional story, retell its situation in original language without adding a new character, setting, or event that changes what happened. If it is general advice, create a clearly illustrative example and do not present it as a verified event. Do not copy sentences or distinctive phrasing.

Write 100-180 words. Use a compact narrative arc: situation, difficulty or turning point, choice or realization, and outcome. Keep it concrete and avoid generic motivational filler.

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
  "body": "100-180 word original story grounded in the source",
  "closing": "one memorable lesson, 8-18 words"
}

Do not add hashtags, emojis, citations, or markdown.`;

    const provider = await getAIProvider();
    const raw = await provider.generateText(prompt, {
      temperature: 0.82,
      numPredict: 420,
    });

    let generated: Record<string, unknown>;
    try {
      const cleaned = raw
        .replace(/^\s*```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed || typeof parsed !== "object") throw new Error("invalid");
      generated = parsed as Record<string, unknown>;
    } catch {
      throw new Error("PostCard story generation returned an invalid response. Please try again.");
    }

    const headline = typeof generated.headline === "string" ? generated.headline.trim() : "";
    const body = typeof generated.body === "string" ? generated.body.trim() : "";
    const closing = typeof generated.closing === "string" ? generated.closing.trim() : "";
    const bodyWords = body ? body.split(/\s+/).filter(Boolean).length : 0;
    const headlineWords = headline ? headline.split(/\s+/).filter(Boolean).length : 0;
    const closingWords = closing ? closing.split(/\s+/).filter(Boolean).length : 0;

    if (!headline || headlineWords < 4 || headlineWords > 12 ||
        bodyWords < 90 || bodyWords > 190 ||
        !closing || closingWords < 6 || closingWords > 24) {
      throw new Error("PostCard story generation returned content outside the required story format. Please try again.");
    }
    return NextResponse.json({
      story: {
        hash: selected.story_hash,
        title: headline,
        body,
        lesson: closing,
        category,
        sourceName: selected.source_name,
        sourceTitle: selected.source_title,
        sourceUrl: selected.source_url,
      },
    });
  } catch (error) {
    console.error("PostCard story generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not generate a motivational story." },
      { status: 502 },
    );
  }
}
