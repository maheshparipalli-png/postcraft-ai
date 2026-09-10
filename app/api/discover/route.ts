import { NextResponse } from "next/server";
import { searchNews } from "@/lib/research/news";

function getWhyItStandsOut(title: string, snippet: string) {
  const text = `${title} ${snippet}`.toLowerCase();

  if (/\b(school|schools|student|students|children|education|teacher|teachers)\b/.test(text)) {
    if (/\b(ai|artificial intelligence|technology|tech)\b/.test(text)) {
      return "It creates a concrete tension between learning about AI and becoming too dependent on it, giving you a useful point to examine.";
    }
    return "It connects a current development to how people learn and adapt, giving you more to explore than the headline alone.";
  }

  if (/\b(risk|warning|crisis|concern|threat|pressure|controversy)\b/.test(text)) {
    return "The story contains a clear tension or risk, which gives you something specific to examine rather than simply report.";
  }

  if (/\b(change|shift|impact|rethink|reversal|decline|rise|fall|surge)\b/.test(text)) {
    return "It points to a change beyond the immediate event, creating room to ask what that shift means in practice.";
  }

  if (/\b(policy|decision|investment|jobs|regulation|government|companies|business)\b/.test(text)) {
    return "It links a current development to a decision, incentive, or consequence that can be examined from more than one side.";
  }

  if (/\b(why|could|will|how)\b/.test(title)) {
    return "The headline raises a real question or possibility, leaving room to examine what is actually changing and why it matters.";
  }

  return "The development is specific enough to build a point of view around, rather than writing another generic post about the topic.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topic = typeof body?.topic === "string" ? body.topic.trim() : "";

    if (!topic) {
      return NextResponse.json({ error: "topic is required" }, { status: 400 });
    }

    if (topic.length > 100) {
      return NextResponse.json({ error: "topic is too long" }, { status: 400 });
    }

    const research = await searchNews(topic);
    const ideas = research.slice(0, 5).map((item, index) => ({
      title: item.title,
      description: item.snippet,
      whyItMatters: getWhyItStandsOut(item.title, item.snippet),
      sourceIndexes: [index],
      source: item.source,
      url: item.url,
      publishedAt: item.publishedAt,
    }));

    return NextResponse.json({ count: research.length, ideas });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
