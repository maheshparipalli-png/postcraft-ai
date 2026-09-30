import { getAIProvider } from "@/lib/ai/provider";
import { parseJsonObject } from "@/lib/ai/json";

export type IdeaAnalysis = {
  keep: boolean;
  title: string;
  description: string;
  whyInteresting: string;
  insight: string;
  category: string;
  angles: { angle: string; why: string; evidence: string }[];
};

export async function analyzeIdea(input: {
  title: string;
  summary: string;
  source: string;
  url: string;
  category: string;
}) {
  const provider = await getAIProvider();
  const prompt = `You are the Idea Radar intelligence layer inside PostCraft AI.

The source is inspiration and factual context, not text to copy.

SOURCE
Title: ${input.title}
Source: ${input.source}
URL: ${input.url}
Summary:
${input.summary}

Determine whether this item contains a genuine LinkedIn-worthy insight for a professional audience.

Reject items that are repetitive, trivial, purely promotional, clickbait, unsupported, or impossible to turn into a meaningful insight. Do not optimize for outrage or controversy.

If it is promising:
1. Explain what actually happened.
2. Explain why it is interesting.
3. Identify the broader insight beneath the story.
4. Generate 3-5 genuinely different LinkedIn angles.

Angles must be materially different, not five rewrites of the same thought.

Do not invent facts, numbers, quotes, motives, examples, or personal experiences.
Use only the supplied material.

Return ONLY JSON:
{
  "keep": true,
  "title": "short idea title",
  "description": "brief factual description",
  "whyInteresting": "why a LinkedIn audience might care",
  "insight": "the broader insight hiding beneath the story",
  "category": "one category",
  "angles": [
    {"angle":"...","why":"...","evidence":"..."}
  ]
}

If it is not suitable, return:
{"keep":false,"title":"","description":"","whyInteresting":"","insight":"","category":"","angles":[]}`;

  const raw = await provider.generateText(prompt, { temperature: 0.35, numPredict: 700 });
  const parsed = parseJsonObject(raw, "Idea Radar analysis");
  return {
    keep: parsed.keep === true,
    title: typeof parsed.title === "string" ? parsed.title.trim() : input.title,
    description: typeof parsed.description === "string" ? parsed.description.trim() : input.summary,
    whyInteresting: typeof parsed.whyInteresting === "string" ? parsed.whyInteresting.trim() : "",
    insight: typeof parsed.insight === "string" ? parsed.insight.trim() : "",
    category: typeof parsed.category === "string" ? parsed.category.trim() : input.category,
    angles: Array.isArray(parsed.angles) ? parsed.angles.map((x) => ({
      angle: typeof x?.angle === "string" ? x.angle.trim() : "",
      why: typeof x?.why === "string" ? x.why.trim() : "",
      evidence: typeof x?.evidence === "string" ? x.evidence.trim() : "",
    })).filter((x) => x.angle && x.why).slice(0,5) : [],
  } satisfies IdeaAnalysis;
}
