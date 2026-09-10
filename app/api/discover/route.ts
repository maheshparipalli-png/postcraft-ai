import { NextResponse } from "next/server";
import { searchNews } from "@/lib/research/news";
import { searchCustomTopic } from "@/lib/research/custom-topic";

function getWhyItStandsOut(title: string, snippet: string, topic: string) {
  const text = `${title} ${snippet}`.toLowerCase();
  const hasEvidence = snippet.trim().length >= 80;

  if (!hasEvidence) {
    return "PostCraft found the headline interesting, but the source did not provide enough usable evidence to confidently recommend a deeper argument yet.";
  }

  if (topic === "PostCraft Recommended") {
    if (/\b(why|how|could|question|debate|risk|benefit|cost|impact|change)\b/i.test(title)) {
      return "PostCraft picked it because the story contains a specific tension or unresolved question, and the available article evidence gives us enough substance to explore it without inventing context.";
    }
    if (/\b(policy|decision|investment|jobs|business|government|security|technology|science)\b/i.test(text)) {
      return "PostCraft picked it because the article connects a concrete development to a decision, trade-off, or consequence that can support a grounded point of view.";
    }
    return "PostCraft picked it because the article contains enough concrete detail to build a specific point of view rather than simply summarize the headline.";
  }

  if (topic === "AI & Technology") {
    return "It is a current AI or technology development with enough source detail to explore what is actually changing, rather than relying on the headline alone.";
  }

  if (topic === "India") {
    return "It is an India-focused development with enough source detail to examine what is changing and why it matters beyond the immediate headline.";
  }

  return `It is a recent development directly related to “${topic}”, with enough source detail to explore a specific point of view rather than simply summarize the topic.`;
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

    const isPresetTopic = topic === "AI & Technology" || topic === "India" || topic === "PostCraft Recommended";
    const research = isPresetTopic ? await searchNews(topic) : await searchCustomTopic(topic);

    if (!research.length) {
      return NextResponse.json(
        { error: `PostCraft could not find enough recent, relevant stories for “${topic}”. Try a broader or more specific topic.` },
        { status: 404 },
      );
    }

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
