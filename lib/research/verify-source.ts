export type VerifiedSource = {
  verified: true;
  url: string;
  title: string;
  source: string;
  publishedAt: string;
  summary: string;
};

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x27;/gi, "'");
}

function cleanText(value: string) {
  return decodeHtml(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMeta(html: string, property: string) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      "i",
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return cleanText(match[1]);
  }

  return "";
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? cleanText(title[1]) : "";
}

function extractDate(html: string) {
  const candidates = [
    extractMeta(html, "article:published_time"),
    extractMeta(html, "datePublished"),
    extractMeta(html, "publish-date"),
    extractMeta(html, "date"),
  ];

  for (const value of candidates) {
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  return "";
}

function extractPublication(html: string, url: string) {
  const candidates = [
    extractMeta(html, "og:site_name"),
    extractMeta(html, "application-name"),
    extractMeta(html, "publisher"),
  ];
  const publication = candidates.find(Boolean);
  if (publication) return publication;

  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function extractJsonLdDescription(html: string) {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );

  if (!scripts) return "";

  for (const script of scripts) {
    const content = script
      .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>/i, "")
      .replace(/<\/script>$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(content);
      const items = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.["@graph"])
          ? parsed["@graph"]
          : [parsed];

      for (const item of items) {
        if (typeof item?.description === "string") {
          return cleanText(item.description);
        }
      }
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
  }

  return "";
}

const genericGoogleNewsText =
  /comprehensive\s+up[-–—]to[-–—]date\s+news\s+coverage,\s+aggregated\s+from\s+sources\s+all\s+over\s+the\s+world\s+by\s+google\s+news/i;

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
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
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

function extractSummary(html: string) {
  const candidates = [
    extractMeta(html, "og:description"),
    extractMeta(html, "description"),
    extractMeta(html, "twitter:description"),
    extractJsonLdDescription(html),
  ];

  return candidates.find(
    (value) => value.length >= 40 && !genericGoogleNewsText.test(value),
  ) ?? "";
}

export async function verifySourceUrl(url: string): Promise<VerifiedSource> {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) throw new Error("The original source URL is missing.");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmedUrl);
  } catch {
    throw new Error("The original source URL is invalid.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Only HTTP and HTTPS source URLs are supported.");
  }

  if (isAggregatorUrl(parsedUrl.toString())) {
    throw new Error(
      "PostCraft received an aggregator URL instead of the original publisher article.",
    );
  }

  const response = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PostCraftSourceVerifier/1.0)",
      Accept: "text/html,application/xhtml+xml",
    },
    redirect: "follow",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`The original source could not be opened. The site returned HTTP ${response.status}.`);
  }

  const finalUrl = response.url || parsedUrl.toString();
  const html = await response.text();
  if (!html || html.length < 200) {
    throw new Error("The original source returned insufficient content.");
  }

  const title =
    extractMeta(html, "og:title") ||
    extractMeta(html, "twitter:title") ||
    extractTitle(html);

  const source = extractPublication(html, finalUrl);
  const summary = extractSummary(html);

  const isAggregator =
    isAggregatorUrl(finalUrl) ||
    isAggregatorSource(source);

  if (!title || isAggregator || genericGoogleNewsText.test(summary)) {
    throw new Error(
      "PostCraft reached an aggregator page instead of the original article. The publisher source could not be verified.",
    );
  }

  return {
    verified: true,
    url: finalUrl,
    title,
    source,
    publishedAt: extractDate(html),
    summary,
  };
}
