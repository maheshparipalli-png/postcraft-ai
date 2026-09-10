import { NextResponse } from "next/server";
import { searchNews } from "@/lib/research/news";

function getWhyItStandsOut(title: string, snippet: string, topic: string) {
  const text = `${title} ${snippet}`.toLowerCase();

  if (topic === "PostCraft Recommended") {
    if (/\b(why|how|could|risk|warning|impact|change|shift|controversy|debate|rethink)\b/.test(text)) {
      return "PostCraft picked it because the story contains a concrete tension or change that can support a point of view, not just a summary.";
    }
    return "PostCraft picked it because the development is specific enough to explore and has room for a meaningful point of view.";
  }

  if (topic === "India") {
    if (/\b(policy|government|jobs|economy|business|investment|technology|ai|education)\b/.test(text)) {
      return "It connects a current Indian development to a decision, shift, or consequence that is worth examining more closely.";
    }
    return "It is a current India-focused development with enough substance to explore beyond the headline.";
  }

  if (topic === "AI & Technology") {
    if (/\b(ai|artificial intelligence|agent|model|technology|tech|data|software|automation)\b/.test(text)) {
      return "It shows a concrete development in AI or technology and gives you something specific to think through.";
    }
    return "It is a timely technology development with room for a specific point of view.";
  }

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
      whyItMatters: getWhyItStandsOut(item.title, item.snippet, topic),
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
