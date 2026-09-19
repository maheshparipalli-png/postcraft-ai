import { NextResponse } from "next/server";

function normalizeProfileUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== "www.linkedin.com" && parsed.hostname !== "linkedin.com") {
    throw new Error("Enter a LinkedIn profile URL.");
  }
  const match = parsed.pathname.match(/^\/in\/([^/]+)\/?$/i);
  if (!match) throw new Error("Enter a LinkedIn profile URL such as https://www.linkedin.com/in/warikoo/.");
  return { url: `https://www.linkedin.com/in/${match[1]}/`, slug: match[1] };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = String(body?.profileUrl || "").trim();
    if (!input) return NextResponse.json({ error: "Enter a LinkedIn profile URL." }, { status: 400 });

    const { url, slug } = normalizeProfileUrl(input);
    const key = process.env.BING_SEARCH_API_KEY;
    if (!key) {
      return NextResponse.json({
        error: "Public post discovery is not configured yet. Add BING_SEARCH_API_KEY to the production environment.",
        code: "SEARCH_PROVIDER_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const query = `site:linkedin.com/posts/ "${slug}" LinkedIn`;
    const searchUrl = new URL("https://api.bing.microsoft.com/v7.0/search");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("count", "10");
    searchUrl.searchParams.set("mkt", "en-US");
    searchUrl.searchParams.set("responseFilter", "Webpages");

    const response = await fetch(searchUrl, {
      headers: { "Ocp-Apim-Subscription-Key": key },
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.message || "The search provider could not find public LinkedIn posts.");

    const candidates = (data?.webPages?.value || [])
      .filter((item: { url?: string }) => /linkedin\.com\/posts\//i.test(item.url || ""))
      .slice(0, 5)
      .map((item: { name?: string; url?: string; snippet?: string; dateLastCrawled?: string }) => ({
        title: String(item.name || "LinkedIn post").trim(),
        url: String(item.url || "").trim(),
        snippet: String(item.snippet || "").trim(),
        discoveredAt: item.dateLastCrawled || null,
      }))
      .filter((item: { url: string; snippet: string }) => item.url && item.snippet);

    return NextResponse.json({
      profile: { url, slug },
      candidates,
      note: "Results are publicly discoverable search-index results, not a direct LinkedIn feed. The first result is the strongest current match, but search indexing cannot guarantee it is the absolute latest post.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not discover LinkedIn posts." }, { status: 400 });
  }
}
