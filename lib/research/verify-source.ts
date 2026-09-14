export type VerifiedSource = {
  verified: true;
  url: string;
  title: string;
  source: string;
  publishedAt: string;
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
    if (match?.[1]) return decodeHtml(match[1].trim());
  }

  return "";
}

function extractTitle(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return title?.[1] ? decodeHtml(title[1].replace(/\s+/g, " ").trim()) : "";
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

  const html = await response.text();
  if (!html || html.length < 200) {
    throw new Error("The original source returned insufficient content.");
  }

  const title = extractMeta(html, "og:title") || extractMeta(html, "twitter:title") || extractTitle(html);
  if (!title) {
    throw new Error("The original source opened, but no article title could be verified.");
  }

  return {
    verified: true,
    url: parsedUrl.toString(),
    title,
    source: extractPublication(html, parsedUrl.toString()),
    publishedAt: extractDate(html),
  };
}
