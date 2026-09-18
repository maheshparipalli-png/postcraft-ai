export type ResearchItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  snippet: string;
  score?: number;
};

const searchQueries: Record<string, string[]> = {
  "AI & Technology": [
    "AI artificial intelligence when:1d",
    "AI agents technology when:1d",
    "technology innovation when:1d",
    "AI business impact when:1d",
  ],
  India: [
    "India business economy when:7d",
    "India government policy when:7d",
    "India technology AI when:7d",
    "India society jobs education when:7d",
  ],
  "PostCraft Recommended": [
    "business leadership change when:7d",
    "India policy economy when:7d",
    "technology AI impact when:7d",
    "science society change when:7d",
    "geopolitics global relations when:7d",
  ],
  Technology: [
    "AI technology when:7d",
    "AI business impact when:7d",
    "technology innovation when:7d",
  ],
  Business: [
    "business strategy when:7d",
    "companies business disruption when:7d",
    "business leadership when:7d",
  ],
  Leadership: [
    "leadership management when:7d",
    "CEO leadership when:7d",
    "workplace organizational change when:7d",
  ],
  Politics: [
    "politics India when:7d",
    "India government policy when:7d",
    "political development India when:7d",
  ],
  Geopolitics: [
    "geopolitics when:7d",
    "India geopolitics when:7d",
    "global relations when:7d",
  ],
  Economy: [
    "India economy when:7d",
    "global economy when:7d",
    "inflation interest rates economy when:7d",
  ],
  Science: [
    "science breakthrough when:7d",
    "scientific research when:7d",
    "science technology when:7d",
  ],
  Society: [
    "society social trends when:7d",
    "workplace society when:7d",
    "social change when:7d",
  ],
};

const genericGoogleNewsText = /comprehensive\\s+up[-–—]to[-–—]date\\s+news\\s+coverage,\\s+aggregated\\s+from\\s+sources\\s+all\\s+over\\s+the\\s+world\\s+by\\s+google\\s+news/i;
const sponsoredStoryText = /\b(sponsored|advertorial|advertisement|advertising|promoted|paid content|partner content|branded content)\b/i;

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
    .replace(/\u00c2\u00b7/g, "·")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function cleanDescription(value: string, title: string, source: string) {
  let description = decodeHtml(value)
    .replace(/\u00c2\u00b7/g, "·")
    .replace(/\s+/g, " ")
    .trim();

  const normalize = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

  const removePrefix = (text: string, target: string) => {
    if (!target) return text;
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.replace(new RegExp(`^\\s*${escaped}\\s*(?:[-–—|·:]\\s*)?`, "i"), "");
  };

  description = removePrefix(description, title);
  description = removePrefix(description, source);
  description = description.replace(/^[-–—|·:]+\s*/, "").replace(/[-–—|·]+\s*$/, "").trim();

  const normalizedDescription = normalize(description);
  const normalizedTitle = normalize(title);
  const normalizedSource = normalize(source);

  if (
    !normalizedDescription ||
    normalizedDescription === normalizedTitle ||
    normalizedDescription === `${normalizedTitle} ${normalizedSource}`.trim() ||
    genericGoogleNewsText.test(description) ||    /^(?:comprehensive\\s+up[-–—]to[-–—]date\\s+news\\s+coverage|news\\s+from\\s+multiple\\s+sources)/i.test(description)
  ) {
    return "";
  }

  return description;
}

function extractArticleText(html: string) {
  const candidates: string[] = [];
  const patterns = [
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) candidates.push(decodeHtml(match[1]));
  }

  const paragraphs = Array.from(html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => decodeHtml(match[1]))
    .filter((text) => text.length >= 60 && text.length <= 1000)
    .filter((text) => !genericGoogleNewsText.test(text))
    .slice(0, 5);

  candidates.push(...paragraphs);
  return candidates.find((text) => text.length >= 60 && !genericGoogleNewsText.test(text)) ?? "";
}

function hasUsableEvidence(item: ResearchItem) {
  return Boolean(item.snippet && item.snippet.length >= 80 && !genericGoogleNewsText.test(item.snippet));
}

const aggregatorHosts = new Set([
  "news.google.com",
  "google.com",
  "www.google.com",
  "bing.com",
  "www.bing.com",
  "news.yahoo.com",
  "yahoo.com",
  "www.yahoo.com",
]);

function hostnameOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\\./, "");
  } catch {
    return "";
  }
}

function isAggregatorUrl(url: string) {
  const hostname = hostnameOf(url);
  return Boolean(hostname && aggregatorHosts.has(hostname));
}

function isAggregatorSource(source: string) {
  return /^(google news|bing news|yahoo news)$/i.test(source.trim());
}

function isGoogleNewsUrl(url: string) {
  return hostnameOf(url) === "news.google.com";
}

function publisherFromUrl(url: string) {
  const hostname = hostnameOf(url);
  if (!hostname || isAggregatorUrl(url)) return "";
  return hostname;
}

function resolveBingUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "www.bing.com" && parsed.pathname === "/news/apiclick.aspx") {
      return parsed.searchParams.get("url") ?? url;
    }
    return url;
  } catch {
    return url;
  }
}

async function enrichItem(item: ResearchItem): Promise<ResearchItem> {
  // Aggregator-labelled items must be resolved before they can enter the
  // candidate pool, even when their feed snippet looks usable.
  if (hasUsableEvidence(item) && !isAggregatorUrl(item.url) && !isAggregatorSource(item.source)) {
    return item;
  }

  try {
    const response = await fetch(item.url, {
      cache: "no-store",
      redirect: "follow",
      headers: { "User-Agent": "PostCraft AI/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return item;

    const resolvedUrl = response.url || item.url;
    if (isAggregatorUrl(resolvedUrl)) return item;

    const html = await response.text();
    const description = extractArticleText(html);
    const resolvedSource = isAggregatorSource(item.source)
      ? publisherFromUrl(resolvedUrl)
      : item.source;

    return {
      ...item,
      url: resolvedUrl,
      source: resolvedSource || item.source,
      snippet: description ? description.slice(0, 900) : item.snippet,
    };
  } catch {
    return item;
  }
}

function sourceFromBingTitle(title: string) {
  const separator = title.lastIndexOf(" - ");
  if (separator > 0) return title.slice(separator + 3).trim();
  return "";
}

async function fetchBingFeed(query: string): Promise<ResearchItem[]> {
  const bingQuery = query.replace(/\s+when:\d+[dhm]\b/gi, "").trim();
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(bingQuery)}&format=rss&mkt=en-IN`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "PostCraft AI/1.0" },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return [];
    const xml = await response.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

    return blocks
      .map((block) => {
        const rawTitle = getTag(block, "title");
        const source = getTag(block, "news:Source") || sourceFromBingTitle(rawTitle);
        const title = source && rawTitle.endsWith(` - ${source}`)
          ? rawTitle.slice(0, -(source.length + 3)).trim()
          : rawTitle;
        return {
          title,
          source,
          url: resolveBingUrl(getTag(block, "link")),
          publishedAt: getTag(block, "pubDate"),
          snippet: cleanDescription(getTag(block, "description"), title, source),
        };
      })
      .filter((item) => item.title && item.url);
  } catch {
    return [];
  }
}

async function fetchFeed(query: string): Promise<ResearchItem[]> {
  // Use Bing as the discovery feed because it can expose direct publisher URLs.
  // Google News is intentionally not used as a fallback: its RSS links are
  // aggregator pages and must never become story URLs in PostCraft.
  return fetchBingFeed(query);
}

function isSponsoredStory(item: ResearchItem) {
  return sponsoredStoryText.test(`${item.title} ${item.source} ${item.snippet}`);
}

function isLowValueStory(item: ResearchItem) {
  const text = `${item.title} ${item.source}`.toLowerCase();
  return [
    "showcase", "to showcase", "portfolio", "conference", "webinar", "summit",
    "investor presentation", "press release", "newsroom", "collaborates with",
    "announces", "announced", "launches", "product launch", "citi global",
  ].some((term) => text.includes(term));
}

function scoreStory(item: ResearchItem, mode: string) {
  const title = item.title.toLowerCase();
  const publishedTime = Date.parse(item.publishedAt);
  const ageHours = Number.isFinite(publishedTime)
    ? Math.max(0, (Date.now() - publishedTime) / (1000 * 60 * 60))
    : 168;

  let score = Math.max(0, 30 - ageHours);
  const strongSignals = [
    "why", "how", "could", "will", "change", "risk", "impact", "shift", "surge",
    "crisis", "warning", "rethink", "future", "breakthrough", "decision", "policy",
    "investment", "jobs", "concern", "threat", "pressure", "decline", "rise", "fall",
    "reversal", "controversy", "question", "debate", "security", "benefit", "cost",
  ];
  const weakSignals = [
    "showcase", "showcases", "announces", "announced", "launches", "launch", "portfolio",
    "conference", "webinar", "event", "summit", "investor presentation", "presentation",
    "press release", "products", "product portfolio", "collaborates with", "newsroom",
  ];

  for (const word of strongSignals) if (title.includes(word)) score += 5;
  for (const word of weakSignals) if (title.includes(word)) score -= 8;
  if (title.includes("?")) score += 8;
  if (/^.*\bto (showcase|announce|launch|unveil)\b/i.test(title)) score -= 12;
  if (/reuters|bbc|bloomberg|associated press|the hindu|indian express|mint|business standard|financial times|economist/i.test(item.source)) score += 5;
  if (hasUsableEvidence(item)) score += 12;
  else score -= mode === "PostCraft Recommended" ? 18 : 5;
  if (title.length >= 45 && title.length <= 140) score += 3;

  if (mode === "AI & Technology" && /\b(ai|artificial intelligence|technology|tech|robot|model|chip|semiconductor|software|cyber)\b/i.test(title)) score += 12;
  if (mode === "India" && /\b(india|indian|delhi|mumbai|bengaluru|hyderabad|modi|government|rupee|rbi|upi)\b/i.test(title)) score += 12;
  if (mode === "PostCraft Recommended") {
    if (/\b(why|how|could|question|debate|risk|trade[- ]?off|benefit|cost|impact|change)\b/i.test(title)) score += 8;
    if (hasUsableEvidence(item)) score += Math.min(12, Math.floor(item.snippet.length / 120) * 3);
  }

  return score;
}

export async function searchNews(topic: string): Promise<ResearchItem[]> {
  const queries = searchQueries[topic] ?? [
    `${topic} latest when:24h`,
    `${topic} developments when:24h`,
  ];

  const results = await Promise.all(queries.map(fetchFeed));
  const combined = results.flat();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  // Google and Bing frequently return the same headline. Build the de-duplicated
  // pool first, but keep the richer/direct-publisher record when both exist.
  const byTitle = new Map<string, ResearchItem>();
  for (const item of combined) {
    // Never let an aggregator URL enter the candidate pool. The selected story
    // must point to a publisher page so source verification can report the
    // actual publication rather than Google News.
    if (isAggregatorUrl(item.url) || isAggregatorSource(item.source)) continue;

    const time = Date.parse(item.publishedAt);
    if (!Number.isFinite(time) || time < cutoff || isSponsoredStory(item) || isLowValueStory(item)) continue;

    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key) continue;

    const existing = byTitle.get(key);
    if (!existing) {
      byTitle.set(key, item);
      continue;
    }

    const existingIsGoogle = isAggregatorUrl(existing.url) || isAggregatorSource(existing.source);
    const itemIsGoogle = isAggregatorUrl(item.url) || isAggregatorSource(item.source);
    if (
      (!hasUsableEvidence(existing) && hasUsableEvidence(item)) ||
      (existingIsGoogle && !itemIsGoogle)
    ) {
      byTitle.set(key, item);
    }
  }

  const candidates = Array.from(byTitle.values())
    .map((item) => ({ ...item, score: scoreStory(item, topic) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const selected: ResearchItem[] = [];
  for (const item of candidates) {
    const itemTokens = titleTokens(item.title);
    const tooSimilar = selected.some((chosen) => {
      const chosenTokens = titleTokens(chosen.title);
      const shared = sharedTokenCount(itemTokens, chosenTokens);
      const phraseOverlap = sharedPhraseCount(item.title, chosen.title);
      return (shared >= 3 && tokenSimilarity(itemTokens, chosenTokens) >= 0.62) || phraseOverlap >= 1;
    });

    if (!tooSimilar) selected.push(item);
    if (selected.length >= (topic === "PostCraft Recommended" ? 24 : 12)) break;
  }

  if (selected.length < 5) {
    for (const item of candidates) {
      if (selected.some((chosen) => chosen.title === item.title)) continue;
      selected.push(item);
      if (selected.length >= 5) break;
    }
  }

  const enriched = await Promise.all(selected.map(enrichItem));
  const reranked = enriched
    .map((item) => ({ ...item, score: scoreStory(item, topic) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (topic === "PostCraft Recommended") {
    const grounded = reranked.filter(hasUsableEvidence);
    const fallback = reranked.filter((item) => !hasUsableEvidence(item));
    // Never render an empty Recommended feed simply because an aggregator did not expose article text.
    // Grounded stories always win; headline-only stories are a last-resort discovery fallback.
    return [...grounded, ...fallback].slice(0, 12);
  }

  return reranked.slice(0, 12);
}

function titleTokens(title: string) {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "is", "are",
    "will", "how", "why", "what", "from", "as", "by", "at", "after", "into", "its", "this", "that", "their",
  ]);

  return new Set(
    title.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 3 && !stopWords.has(word))
  );
}

function sharedPhraseCount(a: string, b: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((word) => word.length >= 4);
  const aWords = normalize(a);
  const bWords = normalize(b);
  const bPhrases = new Set<string>();
  for (let i = 0; i < bWords.length - 1; i += 1) bPhrases.add(`${bWords[i]} ${bWords[i + 1]}`);
  let count = 0;
  for (let i = 0; i < aWords.length - 1; i += 1) if (bPhrases.has(`${aWords[i]} ${aWords[i + 1]}`)) count += 1;
  return count;
}

function sharedTokenCount(a: Set<string>, b: Set<string>) {
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection;
}

function tokenSimilarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  return sharedTokenCount(a, b) / Math.min(a.size, b.size);
}
