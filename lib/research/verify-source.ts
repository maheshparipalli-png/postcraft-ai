import dns from "node:dns/promises";
import net from "node:net";

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

function ipv4ToNumber(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0;
}

function isPrivateOrReservedIp(address: string) {
  const family = net.isIP(address);
  if (family === 4) {
    const value = ipv4ToNumber(address);
    if (value === null) return true;
    const inRange = (start: number, end: number) => value >= start && value <= end;
    return (
      inRange(0x00000000, 0x00ffffff) || // 0.0.0.0/8
      inRange(0x0a000000, 0x0affffff) || // 10.0.0.0/8
      inRange(0x64400000, 0x647fffff) || // 100.64.0.0/10
      inRange(0x7f000000, 0x7fffffff) || // 127.0.0.0/8
      inRange(0xa9fe0000, 0xa9feffff) || // 169.254.0.0/16
      inRange(0xac100000, 0xac1fffff) || // 172.16.0.0/12
      inRange(0xc0000000, 0xc00000ff) || // 192.0.0.0/24
      inRange(0xc0a80000, 0xc0a8ffff) || // 192.168.0.0/16
      inRange(0xc6120000, 0xc613ffff) || // 198.18.0.0/15
      inRange(0xc6336400, 0xc63364ff) || // 198.51.100.0/24
      inRange(0xcb007100, 0xcb0071ff) || // 203.0.113.0/24
      inRange(0xe0000000, 0xffffffff)    // multicast/reserved
    );
  }

  if (family === 6) {
    const normalized = address.toLowerCase();
    const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);
    return (
      normalized === "::" ||
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe8") ||
      normalized.startsWith("fe9") ||
      normalized.startsWith("fea") ||
      normalized.startsWith("feb") ||
      normalized.startsWith("2001:db8") ||
      normalized.startsWith("::ffff:10.") ||
      normalized.startsWith("::ffff:127.") ||
      normalized.startsWith("::ffff:169.254.") ||
      normalized.startsWith("::ffff:192.168.") ||
      normalized.startsWith("::ffff:172.16.") ||
      normalized.startsWith("::ffff:172.17.") ||
      normalized.startsWith("::ffff:172.18.") ||
      normalized.startsWith("::ffff:172.19.") ||
      normalized.startsWith("::ffff:172.20.") ||
      normalized.startsWith("::ffff:172.21.") ||
      normalized.startsWith("::ffff:172.22.") ||
      normalized.startsWith("::ffff:172.23.") ||
      normalized.startsWith("::ffff:172.24.") ||
      normalized.startsWith("::ffff:172.25.") ||
      normalized.startsWith("::ffff:172.26.") ||
      normalized.startsWith("::ffff:172.27.") ||
      normalized.startsWith("::ffff:172.28.") ||
      normalized.startsWith("::ffff:172.29.") ||
      normalized.startsWith("::ffff:172.30.") ||
      normalized.startsWith("::ffff:172.31.") ||
      firstHextet < 0x2000 ||
      firstHextet > 0x3fff
    );
  }

  return true;
}

export async function assertPublicUrl(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP and HTTPS source URLs are supported.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Source URLs with embedded credentials are not supported.");
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw new Error("Only standard HTTP and HTTPS ports are supported.");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "metadata.google.internal") {
    throw new Error("The source URL must point to a public website.");
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) throw new Error("The source URL must point to a public website.");
    return;
  }

  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateOrReservedIp(address))) {
    throw new Error("The source URL resolves to a private or reserved network address.");
  }
}

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

  await assertPublicUrl(parsedUrl.toString());

  if (isAggregatorUrl(parsedUrl.toString())) {
    throw new Error(
      "PostCraft received an aggregator URL instead of the original publisher article.",
    );
  }

  let currentUrl = parsedUrl.toString();
  let response: Response | null = null;

  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    await assertPublicUrl(currentUrl);

    response = await fetch(currentUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PostCraftSourceVerifier/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (response.status < 300 || response.status >= 400) break;

    const location = response.headers.get("location");
    if (!location) throw new Error("The original source returned an invalid redirect.");
    currentUrl = new URL(location, currentUrl).toString();

    if (redirectCount === 5) {
      throw new Error("The original source redirected too many times.");
    }
  }

  if (!response) {
    throw new Error("The original source could not be opened.");
  }

  if (!response.ok) {
    throw new Error(`The original source could not be opened. The site returned HTTP ${response.status}.`);
  }

  const finalUrl = response.url || currentUrl;
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
