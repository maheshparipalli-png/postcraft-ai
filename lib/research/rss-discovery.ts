import { parseFeed } from "@/lib/idea-radar/feed";
import type { ResearchItem } from "@/lib/research/news";
import type { ContentInterest } from "@/lib/content-interests";

type RssSource = {
  name: string;
  url: string;
  interests: ContentInterest[];
};

// Curated publisher feeds are used only by Discover. Evergreen idea seeding
// remains independent and never imports these current stories.
const RSS_SOURCES: RssSource[] = [
  { name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/", interests: ["AI & Technology", "Science", "Business"] },
  { name: "Harvard Business Review", url: "https://feeds.hbr.org/harvardbusiness", interests: ["Business", "Leadership", "Entrepreneurship", "Career & Work", "Marketing & Sales", "Productivity"] },
  { name: "McKinsey Insights", url: "https://www.mckinsey.com/insights/rss", interests: ["Business", "Leadership", "Finance & Economy", "Career & Work", "Marketing & Sales", "Productivity"] },
  { name: "Google AI Blog", url: "https://blog.google/technology/ai/rss/", interests: ["AI & Technology", "Science", "Education"] },
  { name: "Microsoft Research", url: "https://www.microsoft.com/en-us/research/feed/", interests: ["AI & Technology", "Science", "Education", "Healthcare"] },
  { name: "Stanford HAI", url: "https://hai.stanford.edu/news/rss.xml", interests: ["AI & Technology", "Science", "Education", "Healthcare", "Geopolitics"] },
  { name: "HubSpot Marketing", url: "https://blog.hubspot.com/marketing/rss.xml", interests: ["Marketing & Sales", "Business", "Entrepreneurship"] },
];

const MAX_FEED_ITEMS = 15;
const MAX_AGE_DAYS = 14;

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    url.hash = "";
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"]) {
      url.searchParams.delete(key);
    }
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

function sourceHost(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function normalizedTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanSummary(value: string, title: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(new RegExp("^" + title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*", "i"), "")
    .slice(0, 1200);
}

async function readSource(source: RssSource): Promise<ResearchItem[]> {
  try {
    const response = await fetch(source.url, {
      cache: "no-store",
      headers: {
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
        "User-Agent": "PostCraft-Discover/1.0 (+https://www.ninety6ai.online/)",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`${source.name} returned HTTP ${response.status}`);
    const xml = await response.text();
    if (xml.length > 2_000_000) throw new Error(`${source.name} feed exceeded the size limit`);

    const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
    return parseFeed(xml)
      .slice(0, MAX_FEED_ITEMS)
      .map((item) => {
        const url = canonicalUrl(item.link);
        const publishedAt = item.publishedAt || "";
        const summary = cleanSummary(item.summary, item.title);
        const date = Date.parse(publishedAt);
        return {
          title: item.title.trim(),
          source: source.name || sourceHost(url),
          url,
          publishedAt,
          snippet: summary,
          score: Number.isFinite(date) ? Math.max(0, 336 - (Date.now() - date) / 3_600_000) : 0,
        };
      })
      .filter((item) => {
        const date = Date.parse(item.publishedAt);
        return Boolean(
          item.title.length >= 20 &&
          item.url &&
          item.snippet.length >= 40 &&
          Number.isFinite(date) &&
          date >= cutoff &&
          !/\b(sponsored|advertorial|press release|webinar|conference|summit)\b/i.test(`${item.title} ${item.snippet}`)
        );
      });
  } catch (error) {
    console.warn("Discover RSS source unavailable:", source.name, error instanceof Error ? error.message : String(error));
    return [];
  }
}

export async function discoverFromRss(interests: ContentInterest[]) {
  const selectedSources = RSS_SOURCES.filter((source) =>
    source.interests.some((interest) => interests.includes(interest)),
  );
  const settled = await Promise.all(selectedSources.map(async (source) => ({
    source,
    items: await readSource(source),
  })));

  const byUrl = new Map<string, ResearchItem & { interest: ContentInterest }>();
  const byTitle = new Map<string, string>();

  for (const { source, items } of settled) {
    for (const item of items) {
      const interest = source.interests.find((candidate) => interests.includes(candidate));
      if (!interest) continue;
      const urlKey = canonicalUrl(item.url).toLowerCase();
      const titleKey = normalizedTitle(item.title);
      if (!urlKey || !titleKey) continue;
      const existingUrl = byTitle.get(titleKey);
      const key = existingUrl || urlKey;
      const existing = byUrl.get(key);
      const tagged = { ...item, source: item.source || source.name, interest };
      if (!existing || tagged.snippet.length > existing.snippet.length) {
        byUrl.set(key, tagged);
        byTitle.set(titleKey, key);
      }
    }
  }

  const candidates = Array.from(byUrl.values())
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 40);
  const failedInterests = interests
    .filter((interest) => !settled.some(({ source, items }) => source.interests.includes(interest) && items.length > 0))
    .map((interest) => ({ interest, error: "No recent usable stories were available from the configured RSS publishers for this interest." }));

  return { candidates, failedInterests };
}
