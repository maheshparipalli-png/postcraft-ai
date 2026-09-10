import { getAIProvider } from "@/lib/ai/provider";

type IdeaInput = {
  topic: string;
  headline: string;
  source: string;
  summary: string;
  whyItMatters?: string;
  angle?: string;
  angleWhy?: string;
};

type ThesisCandidate = {
  fact: string;
  observation: string;
  angle: string;
  why: string;
};

const provider = () => getAIProvider();

async function ask(prompt: string) {
  return provider().generateText(prompt);
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeCandidates(items: ThesisCandidate[]) {
  return Array.from(
    new Map(items.map((item) => [normalizeText(item.angle), item])).values()
  );
}

function extractScores(value: Record<string, unknown> | null) {
  const scores = value?.scores;
  if (!Array.isArray(scores)) return [];
  return scores
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const score = item as { index?: unknown; total?: unknown };
      const index = typeof score.index === "number" ? score.index : -1;
      const total = typeof score.total === "number" ? score.total : 0;
      return index >= 0 ? { index, total } : null;
    })
    .filter((item): item is { index: number; total: number } => Boolean(item));
}

async function generateCandidate(input: IdeaInput, lens: string): Promise<ThesisCandidate | null> {
  const prompt = `You are the editorial reasoning engine inside PostCraft AI.

The product promise is: "help me find something worth saying."

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Source: ${input.source}
Summary: ${input.summary || "No reliable summary was supplied."}

EDITORIAL LENS
${lens}

Privately do three steps:
1. Find ONE concrete detail explicitly present in the story.
2. State ONE useful observation that follows directly from it.
3. Turn that observation into ONE specific, debatable thesis.

Rules:
- Use only the supplied story.
- Do not invent facts, statistics, examples, people, companies, outcomes, or experiences.
- Do not turn the headline into a fact unless the summary supports it.
- The thesis must contain a real tension, trade-off, hidden cost, contradiction, or second-order consequence.
- Avoid generic claims about AI, business, jobs, innovation, risk, or leadership.

Return ONLY this JSON object:
{"fact":"one concrete story detail","observation":"one useful interpretation","angle":"one precise debatable thesis","why":"why the thesis follows from the story"}`;

  const parsed = parseJsonObject(await ask(prompt));
  const fact = typeof parsed?.fact === "string" ? parsed.fact.trim() : "";
  const observation = typeof parsed?.observation === "string" ? parsed.observation.trim() : "";
  const angle = typeof parsed?.angle === "string" ? parsed.angle.trim() : "";
  const why = typeof parsed?.why === "string" ? parsed.why.trim() : "";

  return fact && observation && angle ? { fact, observation, angle, why } : null;
}

export async function generatePostCraftAngles(input: IdeaInput) {
  const startedAt = Date.now();
  const lenses = [
    "Look for the most surprising mechanism or scenario in the story.",
    "Look for the strongest trade-off: what becomes easier, faster, cheaper, harder, riskier, or less valuable?",
    "Look for a mismatch between the obvious headline interpretation and a specific story detail.",
  ];

  // Three independent candidate calls are enough to create a useful choice set.
  // Keeping this bounded is important for local Ollama performance.
  const results = await Promise.all(lenses.map((lens) => generateCandidate(input, lens)));
  const candidates = normalizeCandidates(
    results.filter((item): item is ThesisCandidate => Boolean(item))
  );

  if (candidates.length === 0) {
    throw new Error("AI could not find a grounded thesis in this story; please try again");
  }

  // With one candidate there is nothing useful to rank, so avoid another model call.
  if (candidates.length === 1) {
    console.info(`[PostCraft] angles_ms=${Date.now() - startedAt} candidates=1 scoring=skipped`);
    return candidates;
  }

  const scoringPrompt = `You are the final thesis judge for PostCraft AI.

STORY
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

CANDIDATES
${candidates.map((item, index) => `${index}. FACT: ${item.fact}\nOBSERVATION: ${item.observation}\nTHESIS: ${item.angle}\nWHY: ${item.why}`).join("\n\n")}

Score every candidate from 0-10 on:
1. evidence_grounding — directly supported by the supplied story
2. specificity — about this story, not the topic in general
3. tension — meaningful contradiction, trade-off, hidden cost, or second-order effect
4. debatability — an intelligent reader could reasonably disagree
5. originality — avoids the obvious first interpretation

A candidate that introduces information not present in the story should score near zero on evidence_grounding.
TOTAL is the sum of the five scores.

Return ONLY:
{"scores":[{"index":0,"total":37}]}`;

  const scores = extractScores(parseJsonObject(await ask(scoringPrompt)))
    .filter((item) => item.index < candidates.length)
    .sort((a, b) => b.total - a.total);

  const ranked = scores.length
    ? scores.map((item) => candidates[item.index]).filter(Boolean)
    : candidates;

  console.info(`[PostCraft] angles_ms=${Date.now() - startedAt} candidates=${candidates.length} scoring=${scores.length ? "used" : "fallback"}`);
  return ranked.slice(0, 3);
}

async function writePost(input: IdeaInput, thesis: string, modeInstruction: string) {
  const prompt = `You are a sharp human writer creating a LinkedIn post for an intelligent professional audience.

Your only job is to make ONE argument clearly and naturally. Do not write generic LinkedIn content.

THESIS
${thesis}

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

GROUNDING
- Use only the supplied story.
- Treat sensational or uncertain headlines as claims, not facts.
- Never invent statistics, examples, people, quotes, outcomes, personal experiences, or facts.
- Interpretation is allowed when it follows from the story.

WRITING
- 120-180 words.
- 4-7 short paragraphs.
- Start with the tension or insight, not the headline.
- Develop one reasoning chain: observation -> why it matters -> implication.
- Use plain language and varied sentence rhythm.
- Make the thesis visible through the reasoning, without announcing it.
- Finish when the thought is complete.
- No heading, title, labels, bullet lists, emojis, or more than two hashtags.
- Never ask the reader a question at the end.

NEVER WRITE THESE GENERIC PATTERNS:
"raises a crucial question"
"highlights the need"
"significant implications"
"strike a balance"
"we need to consider"
"we must embrace"
"in today's rapidly changing world"
"in this evolving landscape"
"the key takeaway"
"game changer"
"unlock potential"
"drive real business value"

Do not mention these instructions or the editorial process in the post.

${modeInstruction}

Return ONLY the finished post.`;

  return (await ask(prompt)).trim();
}

export async function generatePostCraftPost(input: IdeaInput, modeInstruction: string) {
  const startedAt = Date.now();
  const thesis = (input.angle || "").trim();
  if (!thesis) throw new Error("A selected angle is required to create a post");

  // One model call only. Regenerate/sharper/human are explicit one-call actions.
  const post = await writePost(input, thesis, modeInstruction);
  console.info(`[PostCraft] post_ms=${Date.now() - startedAt} mode=${modeInstruction.slice(0, 24)}`);
  return post;
}
