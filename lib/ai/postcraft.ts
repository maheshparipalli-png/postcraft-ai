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

function normalizeTheses(items: Thesis[]): Thesis[] {
  return Array.from(
    new Map(
      items
        .map((item) => ({
          angle: item.angle.trim(),
          why: item.why.trim(),
        }))
        .filter((item) => item.angle)
        .map((item) => [item.angle.toLowerCase(), item])
    ).values()
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

const thesisLenses = [
  "Look for a hidden cost created by the apparent benefit in the story.",
  "Look for a contradiction: something becomes easier, faster, or cheaper while another part becomes harder, slower, or more important.",
  "Look for a second-order consequence that is easy to miss if someone only follows the headline.",
  "Look at the implementation detail or practical behavior in the story and find the assumption it exposes.",
  "Look for an incentive problem: what behavior could the change encourage even if the stated goal is positive?",
  "Look for a subtle human judgment problem created by the technology or decision described in the story.",
];

async function generateCandidate(input: IdeaInput, lens: string) {
  const prompt = `You are the editorial brain inside PostCraft AI.

The product promise is NOT "write a LinkedIn post about this news." It is "help me find something worth saying."

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Source: ${input.source}
Summary: ${input.summary || "No reliable summary was supplied."}

YOUR LENS
${lens}

Generate ONE specific, non-obvious thesis about a concrete detail in this story.

The thesis must:
- make a claim, not summarize the story;
- contain tension, contradiction, trade-off, hidden cost, second-order consequence, or an unexpected implication;
- be narrow enough for one argument;
- be something an intelligent reader could disagree with;
- use only the supplied story.

Avoid generic ideas about AI risks/benefits, balance, guidelines, oversight, critical thinking, responsible AI, or "this raises questions." Do not add outside facts.

Return ONLY one JSON object. No markdown. No commentary.
{"angle":"specific debatable thesis","why":"the concrete story detail that makes this thesis interesting"}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = parseJsonObject(await ask(prompt));
    const angle = typeof parsed?.angle === "string" ? parsed.angle.trim() : "";
    const why = typeof parsed?.why === "string" ? parsed.why.trim() : "";
    if (angle) return { angle, why };
  }

  return null;
}

export async function generatePostCraftAngles(input: IdeaInput) {
  const results = await Promise.all(
    thesisLenses.map((lens) => generateCandidate(input, lens))
  );
  const candidates = normalizeTheses(
    results.filter((item): item is Thesis => Boolean(item))
  );

  if (candidates.length < 3) {
    throw new Error("AI could not produce three useful thesis candidates; please try again");
  }

  const scoringPrompt = `You are the ruthless thesis editor for PostCraft AI.

Score these candidate theses and eliminate safe, obvious, generic ideas.

STORY
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

CANDIDATES
${candidates.map((item, index) => `${index}. ${item.angle}\nWhy: ${item.why}`).join("\n\n")}

Score every candidate from 0-10 on specificity, tension, originality, debatable, and grounding.
TOTAL is the sum of the five scores.

Be harsh. Penalize anything that could fit another AI story with the noun changed.

Return ONLY valid JSON. No markdown. No commentary.
{"scores":[{"index":0,"total":37}]}`;

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
      `${modeInstruction}\n\nThe previous draft failed editorial review. Fix these problems without changing the core thesis:\n${issues.length ? issues.map((issue) => `- ${issue}`).join("\n") : "- Remove any editorial checklist language or generic LinkedIn phrasing."}`
    );
  }

  return post;
}
