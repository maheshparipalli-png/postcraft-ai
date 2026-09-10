import type { ResearchItem } from "./news";

const genericGoogleNewsText = /comprehensive, up-to-date news coverage, aggregated from sources all over the world by google news/i;

function decodeHtml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function cleanSnippet(value: string, title: string, source: string) {
  let snippet = decodeHtml(value);
  const removePrefix = (text: string, target: string) => {
    if (!target) return text;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(`^\\s*${escaped}\\s*(?:[-–—|·:]\\s*)?`, "i"), "");
  };
  snippet = removePrefix(snippet, title);
  snippet = removePrefix(snippet, source);
  snippet = snippet.replace(/^[-–—|·:]+\s*/, "").trim();
  return genericGoogleNewsText.test(snippet) ? "" : snippet;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function topicTerms(topic: string) {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "is", "are", "was", "were",
    "how", "why", "what", "when", "where", "who", "can", "could", "will", "would", "should", "about",
    "latest", "news", "impact", "future", "today", "new",
  ]);
  return normalize(topic).split(" ").filter((term) => term.length >= 3 && !stopWords.has(term));
}

function relevanceScore(item: ResearchItem, topic: string) {
  const terms = topicTerms(topic);
  if (!terms.length) return 0;
  const title = normalize(item.title);
  const body = normalize(item.snippet);
  let score = 0;
  let titleMatches = 0;
  let bodyMatches = 0;

  for (const term of terms) {
    if (title.includes(term)) {
      score += 12;
      titleMatches += 1;
    } else if (body.includes(term)) {
      score += 4;
      bodyMatches += 1;
    }
  }

  const phrase = normalize(topic).replace(/\b(latest|news|today)\b/g, "").trim();
  if (phrase.length >= 5 && title.includes(phrase)) score += 20;
  if (titleMatches >= Math.min(2, terms.length)) score += 8;
  if (bodyMatches >= Math.min(2, terms.length)) score += 4;
  if (item.snippet.length >= 80) score += 5;
  if (/reuters|bbc|bloomberg|associated press|the hindu|indian express|mint|business standard|financial times|economist/i.test(item.source)) score += 4;

  return score;
}

function passesRelevance(item: ResearchItem, topic: string) {
  const terms = topicTerms(topic);
  if (!terms.length) return false;
  const title = normalize(item.title);
  const body = normalize(item.snippet);
  const titleMatches = terms.filter((term) => title.includes(term)).length;
  const bodyMatches = terms.filter((term) => body.includes(term)).length;

  if (terms.length === 1) return titleMatches === 1 || bodyMatches === 1;
  if (terms.length === 2) return titleMatches >= 1 && bodyMatches >= 1 || titleMatches >= 2;
  return titleMatches >= 2 || (titleMatches >= 1 && bodyMatches >= 2);
}

function sourceFromBingTitle(title: string) {
  const separator = title.lastIndexOf(" - ");
  if (separator > 0) return title.slice(separator + 3).trim();
  return "";
}

async function fetchGoogle(query: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "PostCraft AI/1.0" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return [] as ResearchItem[];
    const xml = await response.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    return blocks.map((block) => {
      const title = getTag(block, "title");
      const source = getTag(block, "source");
      return {
        title,
        source,
        url: getTag(block, "link"),
        publishedAt: getTag(block, "pubDate"),
        snippet: cleanSnippet(getTag(block, "description"), title, source),
      };
    }).filter((item) => item.title && item.url);
  } catch {
    return [] as ResearchItem[];
  }
}

async function fetchBing(query: string) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&mkt=en-IN`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "PostCraft AI/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return [] as ResearchItem[];
    const xml = await response.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    return blocks.map((block) => {
      const rawTitle = getTag(block, "title");
      const source = getTag(block, "news:Source") || sourceFromBingTitle(rawTitle);
      const title = source && rawTitle.endsWith(` - ${source}`)
        ? rawTitle.slice(0, -(source.length + 3)).trim()
        : rawTitle;
      return {
        title,
        source,
        url: getTag(block, "link"),
        publishedAt: getTag(block, "pubDate"),
        snippet: cleanSnippet(getTag(block, "description"), title, source),
      };
    }).filter((item) => item.title && item.url);
  } catch {
    return [] as ResearchItem[];
  }
}

function dedupe(items: ResearchItem[]) {
  const seen = new Map<string, ResearchItem>();
  for (const item of items) {
    const key = normalize(item.title);
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing || (!existing.snippet && item.snippet)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

export async function searchCustomTopic(topic: string): Promise<ResearchItem[]> {
  const cleanedTopic = topic.trim();
  const queries = [
    `${cleanedTopic} when:7d`,
    `"${cleanedTopic}" when:7d`,
    `${cleanedTopic} latest when:7d`,
  ];

  const batches = await Promise.all(queries.map(async (query) => {
    const [google, bing] = await Promise.all([fetchGoogle(query), fetchBing(query)]);
    return [...google, ...bing];
  }));

  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const candidates = dedupe(batches.flat())
    .filter((item) => {
      const published = Date.parse(item.publishedAt);
      return Number.isFinite(published) && published >= cutoff;
    })
    .filter((item) => passesRelevance(item, cleanedTopic))
    .map((item) => ({ ...item, score: relevanceScore(item, cleanedTopic) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const selected: ResearchItem[] = [];
  for (const item of candidates) {
    const title = normalize(item.title);
    const duplicate = selected.some((chosen) => {
      const chosenTitle = normalize(chosen.title);
      return title === chosenTitle || title.includes(chosenTitle) || chosenTitle.includes(title);
    });
    if (duplicate) continue;
    selected.push(item);
    if (selected.length === 5) break;
  }

  return selected;
}
