import { NextResponse } from "next/server";

// CommentCraft public discovery uses Tavily; Bing Search API is retired.

function normalizeProfileUrl(value: string) {
  const parsed = new URL(value);
  if (parsed.hostname !== "www.linkedin.com" && parsed.hostname !== "linkedin.com") {
    throw new Error("Enter a LinkedIn profile URL.");
  }
  const match = parsed.pathname.match(/^\/in\/([^/]+)\/?$/i);
  if (!match) throw new Error("Enter a LinkedIn profile URL such as https://www.linkedin.com/in/warikoo/.");
  return { url: `https://www.linkedin.com/in/${match[1]}/`, slug: match[1] };
}

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
  published_date?: string;
  score?: number;
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = String(body?.profileUrl || "").trim();
    if (!input) return NextResponse.json({ error: "Enter a LinkedIn profile URL." }, { status: 400 });

    const { url, slug } = normalizeProfileUrl(input);
    const key = process.env.TAVILY_API_KEY;
    if (!key) {
      return NextResponse.json({
        error: "Public post discovery is not configured yet. Add TAVILY_API_KEY to the production environment.",
        code: "SEARCH_PROVIDER_NOT_CONFIGURED",
      }, { status: 503 });
    }

    const query = `site:linkedin.com/posts/ "${slug}" LinkedIn`;
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        topic: "general",
        search_depth: "basic",
        max_results: 10,
        include_answer: false,
        include_raw_content: false,
        include_domains: ["linkedin.com"],
      }),
      cache: "no-store",
    });

    const data = await response.json();
    if (!response.ok) {
      const detail = data?.detail || data?.error || data?.message;
      throw new Error(typeof detail === "string" ? detail : "The search provider could not find public LinkedIn posts.");
    }

    const candidates = (Array.isArray(data?.results) ? data.results : [])
      .filter((item: TavilyResult) => /linkedin\.com\/posts\//i.test(String(item.url || "")))
      .slice(0, 5)
      .map((item: TavilyResult) => ({
        title: String(item.title || "LinkedIn post").trim(),
        url: String(item.url || "").trim(),
        snippet: String(item.content || "").trim(),
        discoveredAt: item.published_date || null,
        score: typeof item.score === "number" ? item.score : null,
      }))
      .filter((item: { url: string; snippet: string }) => item.url && item.snippet);

    return NextResponse.json({
      profile: { url, slug },
      candidates,
      note: "Results come from public web search indexing rather than direct LinkedIn scraping. The first result is the strongest search match, but indexing cannot guarantee it is the absolute latest post or expose the full post text.",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not discover LinkedIn posts." }, { status: 400 });
  }
}
