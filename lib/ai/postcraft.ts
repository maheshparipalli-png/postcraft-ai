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

type Thesis = { angle: string; why: string };

const provider = () => getAIProvider();

async function ask(prompt: string) {
  return provider().generateText(prompt);
}

function parseJsonArray(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
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

function normalizeTheses(items: unknown[]): Thesis[] {
  const candidates = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as { angle?: unknown; why?: unknown };
      const angle = typeof value.angle === "string" ? value.angle.trim() : "";
      const why = typeof value.why === "string" ? value.why.trim() : "";
      return angle ? { angle, why } : null;
    })
    .filter((item): item is Thesis => Boolean(item));

  return Array.from(
    new Map(candidates.map((item) => [item.angle.toLowerCase(), item])).values()
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

export async function generatePostCraftAngles(input: IdeaInput) {
  const candidatePrompt = `You are the editorial brain inside PostCraft AI.

The product promise is NOT "write a LinkedIn post about this news." It is "help me find something worth saying."

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Source: ${input.source}
Summary: ${input.summary || "No reliable summary was supplied."}

Generate EIGHT genuinely different candidate theses. A thesis is a specific belief or observation that a smart professional could reasonably argue about after reading this story.

A strong thesis:
- makes a non-obvious claim about a DETAIL in this story;
- contains tension, contradiction, trade-off, second-order consequence, or an unexpected implication;
- is narrow enough to support one argument;
- gives the reader a reason to reconsider the obvious interpretation;
- could be challenged by an intelligent reader.

Prefer mechanisms and consequences over advice. Look for details that create tension: something becoming easier while something else becomes harder; a claimed benefit creating a hidden cost; a change solving one problem while creating another; an assumption in the story that deserves scrutiny.

Reject your own obvious first ideas before answering.

DO NOT produce:
- a summary of the story;
- a topic disguised as a thesis;
- "AI has benefits and risks";
- "we need balance/guidelines/oversight";
- "this raises questions";
- generic critical-thinking or responsible-AI statements;
- a thesis that would fit almost any AI story;
- facts not present in the supplied story.

Return ONLY valid JSON with exactly 8 objects:
[{"angle":"specific debatable thesis","why":"the story detail that makes this thesis interesting"}]`;

  const candidates = normalizeTheses(parseJsonArray(await ask(candidatePrompt))).slice(0, 8);
  if (candidates.length < 3) return [];

  const scoringPrompt = `You are the ruthless thesis editor for PostCraft AI.

Your job is NOT to praise these theses. Score them and eliminate safe, obvious, generic ideas.

STORY
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

CANDIDATES
${candidates.map((item, index) => `${index}. ${item.angle}\nWhy: ${item.why}`).join("\n\n")}

Score every candidate from 0-10 on:
- specificity: tied to a concrete detail rather than the broad topic
- tension: contains a real contradiction, trade-off, hidden cost, or consequence
- originality: makes the reader reconsider the obvious interpretation
- debatable: an intelligent person could reasonably disagree
- grounding: supported by the supplied story without invented facts

TOTAL is the sum of the five scores.

Be especially harsh. A thesis loses points if it says the obvious, recommends "balance," asks for "guidelines," warns about "risks," or could be reused for another AI story with only the noun changed.

Return ONLY valid JSON:
{"scores":[{"index":0,"total":37},{"index":1,"total":31}]}`;

  const scores = extractScores(parseJsonObject(await ask(scoringPrompt)))
    .filter((item) => item.index < candidates.length)
    .sort((a, b) => b.total - a.total);

  const ranked = scores.length
    ? scores.map((item) => candidates[item.index]).filter(Boolean)
    : candidates;

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
- Make the thesis visible through the reasoning, without announcing "my thesis is".
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

function looksLikeEditorialLeak(post: string) {
  const lower = post.toLowerCase();
  return [
    "does the opening reveal",
    "do any sentences sound",
    "unsupported facts or fake personal experiences",
    "one clear, debatable point",
    "what do you think?",
    "agree?",
    "thoughts?",
    "consider the following red flags",
  ].some((phrase) => lower.includes(phrase));
}

async function inspectPost(thesis: string, post: string) {
  const prompt = `You are a strict final editor.

THESIS
${thesis}

DRAFT
${post}

Judge only these criteria:
1. argument: one clear, debatable argument
2. opening: starts with a concrete insight or tension
3. specificity: connected to this story, not generic AI commentary
4. naturalness: sounds like a person thinking, not LinkedIn/AI filler
5. grounding: no unsupported facts or invented experiences
6. completion: ends naturally without a forced engagement question

Return ONLY valid JSON:
{"pass":true,"issues":[]}
OR
{"pass":false,"issues":["specific problem 1","specific problem 2"]}`;

  return parseJsonObject(await ask(prompt));
}

export async function generatePostCraftPost(input: IdeaInput, modeInstruction: string) {
  const thesisPrompt = `You are the thesis editor for PostCraft AI.

Story headline: ${input.headline}
Story summary: ${input.summary || "No reliable summary was supplied."}
Selected thesis: ${input.angle || "No thesis supplied."}
Why it matters: ${input.angleWhy || "Not supplied."}

Rewrite the selected thesis into ONE precise, debatable sentence.
Keep its core idea. Make it specific to the supplied story. Do not add facts.
Return only the thesis sentence.`;

  const thesis = (await ask(thesisPrompt))
    .replace(/^\s*["']|["']\s*$/g, "")
    .trim();

  let post = await writePost(input, thesis, modeInstruction);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const editorialLeak = looksLikeEditorialLeak(post);
    const inspection = await inspectPost(thesis, post);
    const pass = !editorialLeak && inspection?.pass === true;

    if (pass) return post;

    const issues = Array.isArray(inspection?.issues)
      ? inspection.issues.filter((item): item is string => typeof item === "string")
      : [];

    post = await writePost(
      input,
      thesis,
      `${modeInstruction}

The previous draft failed editorial review. Fix these problems without changing the core thesis:
${issues.length ? issues.map((issue) => `- ${issue}`).join("\n") : "- Remove any editorial checklist language or generic LinkedIn phrasing."}`
    );
  }

  return post;
}
