export type FeedItem = {
  title: string;
  link: string;
  summary: string;
  publishedAt: string | null;
};

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstTag(xml: string, tag: string) {
  const match = new RegExp("<" + tag + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + tag + ">", "i").exec(xml);
  return match ? decodeXml(match[1]) : "";
}

export function parseFeed(xml: string): FeedItem[] {
  const blocks = [
    ...Array.from(xml.matchAll(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi)).map((m) => m[0]),
    ...Array.from(xml.matchAll(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi)).map((m) => m[0]),
  ];

  return blocks.map((block) => {
    const title = firstTag(block, "title");
    const linkTag = /<link(?:\s[^>]*)?>([\s\S]*?)<\/link>/i.exec(block);
    const hrefTag = /<link[^>]+href=["']([^"']+)["'][^>]*\/?\s*>/i.exec(block);
    const link = decodeXml(hrefTag?.[1] || linkTag?.[1] || "");
    const summary = firstTag(block, "description") || firstTag(block, "summary") || firstTag(block, "content:encoded") || "";
    const published = firstTag(block, "pubDate") || firstTag(block, "published") || firstTag(block, "updated");
    const date = published ? new Date(published) : null;
    return {
      title: title.slice(0, 240),
      link,
      summary: summary.slice(0, 3500),
      publishedAt: date && !Number.isNaN(date.getTime()) ? date.toISOString() : null,
    };
  }).filter((item) => item.title && /^https?:\/\//i.test(item.link));
}

export async function fetchFeed(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml",
      "User-Agent": "PostCraft AI Idea Radar/1.0",
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Feed returned HTTP " + response.status);
  return parseFeed(await response.text());
}

export function normalizeTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
