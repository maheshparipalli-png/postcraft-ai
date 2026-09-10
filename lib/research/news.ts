export type ResearchItem = {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  snippet: string;
  score?: number;
};

const searchQueries: Record<string, string[]> = {
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
  const match = block.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i")
  );

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
    return text.replace(
      new RegExp(`^\\s*${escaped}\\s*(?:[-–—|·:]\\s*)?`, "i"),
      ""
    );
  };

  description = removePrefix(description, title);
  description = removePrefix(description, source);
  description = description
    .replace(/^[-–—|·:]+\s*/, "")
    .replace(/[-–—|·]+\s*$/, "")
    .trim();

  const normalizedDescription = normalize(description);
  const normalizedTitle = normalize(title);
  const normalizedSource = normalize(source);

  // Google News frequently returns the headline, headline + source, or
  // headline + source separated by a middle dot instead of a real summary.
  if (
    !normalizedDescription ||
    normalizedDescription === normalizedTitle ||
    normalizedDescription === `${normalizedTitle} ${normalizedSource}`.trim() ||
    normalizedDescription === `${normalizedTitle} ${normalizedSource}`.trim().replace(/\s+/g, " ")
  ) {
    return "";
  }

  return description;
}

async function fetchFeed(query: string): Promise<ResearchItem[]> {
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    `&hl=en-IN&gl=IN&ceid=IN:en`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent": "PostCraft AI/1.0",
      },
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

    return blocks
      .map((block) => {
        const title = getTag(block, "title");
        const source = getTag(block, "source");

        return {
          title,
          source,
          url: getTag(block, "link"),
          publishedAt: getTag(block, "pubDate"),
          snippet: cleanDescription(getTag(block, "description"), title, source),
        };
      })
      .filter((item) => item.title && item.url);
  } catch {
    return [];
  }
}

function isLowValueStory(item: ResearchItem) {
  const text = `${item.title} ${item.source}`.toLowerCase();

  return [
    "showcase",
    "to showcase",
    "portfolio",
    "conference",
    "webinar",
    "summit",
    "investor presentation",
    "press release",
    "newsroom",
    "collaborates with",
    "announces",
    "announced",
    "launches",
    "product launch",
    "citi global",
  ].some((term) => text.includes(term));
}

function scoreStory(item: ResearchItem) {
  const title = item.title.toLowerCase();
  const publishedTime = Date.parse(item.publishedAt);
  const ageHours = Number.isFinite(publishedTime)
    ? Math.max(0, (Date.now() - publishedTime) / (1000 * 60 * 60))
    : 168;

  let score = Math.max(0, 30 - ageHours);

  const strongSignals = [
    "why",
    "how",
    "could",
    "will",
    "change",
    "risk",
    "impact",
    "shift",
    "surge",
    "crisis",
    "warning",
    "rethink",
    "future",
    "breakthrough",
    "decision",
    "policy",
    "investment",
    "jobs",
    "concern",
    "threat",
    "pressure",
    "decline",
    "rise",
    "fall",
    "reversal",
    "controversy",
  ];

  const weakSignals = [
    "showcase",
    "showcases",
    "announces",
    "announced",
    "launches",
    "launch",
    "portfolio",
    "conference",
    "webinar",
    "event",
    "summit",
    "investor presentation",
    "presentation",
    "press release",
    "products",
    "product portfolio",
    "collaborates with",
    "newsroom",
  ];

  for (const word of strongSignals) {
    if (title.includes(word)) score += 5;
  }

  for (const word of weakSignals) {
    if (title.includes(word)) score -= 8;
  }

  if (title.includes("?")) score += 8;

  if (/^.*\bto (showcase|announce|launch|unveil)\b/i.test(title)) {
    score -= 12;
  }

  if (
    /reuters|bbc|bloomberg|associated press|the hindu|indian express|mint|business standard|financial times|economist/i.test(
      item.source
    )
  ) {
    score += 5;
  }

  if (item.snippet.length >= 80) score += 5;
  if (title.length >= 45 && title.length <= 140) score += 3;

  return score;
}

export async function searchNews(topic: string): Promise<ResearchItem[]> {
  const queries =
    searchQueries[topic] ?? [
      `${topic} latest when:7d`,
      `${topic} business when:7d`,
      `${topic} developments when:7d`,
    ];

  const results = await Promise.all(queries.map(fetchFeed));
  const combined = results.flat();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const seen = new Set<string>();

  const candidates = combined
    .filter((item) => {
      const time = Date.parse(item.publishedAt);
      return (
        Number.isFinite(time) &&
        time >= cutoff &&
        !isLowValueStory(item)
      );
    })
    .filter((item) => {
      const key = item.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((item) => ({ ...item, score: scoreStory(item) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  // Keep the final shortlist diverse. Different outlets frequently publish
  // near-identical headlines about the same event, so exact-title deduping is
  // not enough for a useful "five ideas" experience.
  const selected: ResearchItem[] = [];

  for (const item of candidates) {
    const itemTokens = titleTokens(item.title);
    const tooSimilar = selected.some((chosen) => {
      const chosenTokens = titleTokens(chosen.title);
      const shared = sharedTokenCount(itemTokens, chosenTokens);
      const phraseOverlap = sharedPhraseCount(item.title, chosen.title);
      return (shared >= 3 && tokenSimilarity(itemTokens, chosenTokens) >= 0.62) || phraseOverlap >= 1;
    });

    if (!tooSimilar) {
      selected.push(item);
    }

    if (selected.length >= 12) break;
  }

  // If the topic is narrow, relax the diversity rule only enough to return a
  // useful shortlist rather than returning too few ideas.
  if (selected.length < 5) {
    for (const item of candidates) {
      if (selected.some((chosen) => chosen.title === item.title)) continue;
      selected.push(item);
      if (selected.length >= 5) break;
    }
  }

  return selected;
}

function titleTokens(title: string) {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for",
    "with", "is", "are", "will", "how", "why", "what", "from", "as",
    "by", "at", "after", "into", "its", "this", "that", "their",
  ]);

  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 3 && !stopWords.has(word))
  );
}

function sharedPhraseCount(a: string, b: string) {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4);

  const aWords = normalize(a);
  const bWords = normalize(b);
  const bPhrases = new Set<string>();

  for (let i = 0; i < bWords.length - 1; i += 1) {
    bPhrases.add(`${bWords[i]} ${bWords[i + 1]}`);
  }

  let count = 0;
  for (let i = 0; i < aWords.length - 1; i += 1) {
    if (bPhrases.has(`${aWords[i]} ${aWords[i + 1]}`)) count += 1;
  }

  return count;
}

function sharedTokenCount(a: Set<string>, b: Set<string>) {
  let intersection = 0;

  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }

  return intersection;
}

function tokenSimilarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  return sharedTokenCount(a, b) / Math.min(a.size, b.size);
}
