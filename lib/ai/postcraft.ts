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
  evidence: string;
  observation: string;
  angle: string;
  why: string;
};

const provider = () => getAIProvider();

async function ask(
  prompt: string,
  options?: Parameters<ReturnType<typeof provider>["generateText"]>[1]
) {
  return provider().generateText(prompt, options);
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

function isGroundedEvidence(evidence: string, input: IdeaInput) {
  const quote = normalizeText(evidence);
  const source = normalizeText(`${input.headline} ${input.summary}`);
  if (quote.length < 12 || !source) return false;
  if (source.includes(quote)) return true;

  const quoteWords = quote.split(" ").filter((word) => word.length >= 4);
  const sourceWords = new Set(source.split(" "));
  const matched = quoteWords.filter((word) => sourceWords.has(word)).length;
  return quoteWords.length >= 4 && matched / quoteWords.length >= 0.75;
}

function normalizeCandidates(items: ThesisCandidate[]) {
  return Array.from(new Map(items.map((item) => [normalizeText(item.angle), item])).values());
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

Do this privately:
1. Select ONE exact detail or short phrase explicitly present in the headline or summary.
2. Explain ONE interpretation that follows from that evidence.
3. Turn that interpretation into ONE specific, debatable thesis.

GROUNDING IS STRICT:
- The headline and summary are the complete evidence set. You know nothing else about this story.
- The evidence field MUST quote wording from the supplied headline or summary.
- The thesis may interpret the evidence, but must not introduce a new event, consequence, group, statistic, outcome, example, or causal claim that the story does not support.
- Do NOT infer social unrest, inequality, job losses, wage stagnation, public reaction, political consequences, market consequences, or other second-order effects unless the supplied story explicitly supports them.
- Never turn a "could", "may", "might", "warns", or "possible" claim into an established fact.
- If the story is too thin to support a meaningful thesis, return empty strings rather than inventing context.
- Avoid generic claims about AI, business, jobs, innovation, risk, or leadership.

QUALITY:
- One clear claim.
- Specific to this story.
- Contains a real tension, trade-off, contradiction, hidden cost, or conditional consequence.
- Debatable without becoming speculative.

Return ONLY this JSON object:
{"evidence":"exact short phrase from the headline or summary","observation":"one interpretation that follows from that evidence","angle":"one precise debatable thesis","why":"one sentence explaining why the thesis follows from the evidence"}`;

  try {
    const parsed = parseJsonObject(await ask(prompt, { format: "json", temperature: 0.35, numPredict: 300 }));
    const evidence = typeof parsed?.evidence === "string" ? parsed.evidence.trim() : "";
    const observation = typeof parsed?.observation === "string" ? parsed.observation.trim() : "";
    const angle = typeof parsed?.angle === "string" ? parsed.angle.trim() : "";
    const why = typeof parsed?.why === "string" ? parsed.why.trim() : "";

    if (!evidence || !observation || !angle || !isGroundedEvidence(evidence, input)) return null;
    return { evidence, observation, angle, why };
  } catch (error) {
    console.warn("[PostCraft] candidate_failed", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export async function generatePostCraftAngles(input: IdeaInput) {
  const startedAt = Date.now();
  const lenses = [
    "Look for the most surprising mechanism or scenario actually supported by the story.",
    "Look for the strongest trade-off explicitly supported by the story: what becomes easier, harder, more valuable, or less valuable?",
    "Look for a mismatch between the obvious headline interpretation and a specific detail in the story.",
  ];

  const results = await Promise.all(lenses.map((lens) => generateCandidate(input, lens)));
  const candidates = normalizeCandidates(results.filter((item): item is ThesisCandidate => Boolean(item)));

  if (candidates.length === 0) {
    throw new Error("AI could not find a sufficiently grounded thesis in this story; please try another story");
  }

  if (candidates.length === 1) {
    console.info(`[PostCraft] angles_ms=${Date.now() - startedAt} candidates=1 scoring=skipped`);
    return candidates;
  }

  const scoringPrompt = `You are the final evidence judge for PostCraft AI.

STORY EVIDENCE
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

CANDIDATES
${candidates.map((item, index) => `${index}. EVIDENCE: ${item.evidence}\nOBSERVATION: ${item.observation}\nTHESIS: ${item.angle}\nWHY: ${item.why}`).join("\n\n")}

Score every candidate from 0-10 on:
1. evidence_grounding — could every important part of the thesis reasonably be traced to the supplied headline/summary?
2. specificity — is it about this exact story rather than the topic generally?
3. tension — is there a real trade-off, contradiction, hidden cost, or conditional consequence?
4. debatability — could an intelligent reader reasonably disagree?
5. originality — is it more interesting than simply restating the headline?

CRITICAL:
- Treat anything not supported by the supplied story as speculation.
- A candidate that adds social unrest, inequality, job losses, wage effects, public reaction, political consequences, market effects, or other outcomes not present in the story should score 0-2 for evidence_grounding.
- Do not reward a candidate merely because the added consequence sounds plausible.
- Prefer a narrower, fully supported thesis over a dramatic but speculative one.

TOTAL is the sum of the five scores.
Return ONLY:
{"scores":[{"index":0,"total":37}]}`;

  let scores: { index: number; total: number }[] = [];
  try {
    scores = extractScores(parseJsonObject(await ask(scoringPrompt, { format: "json", temperature: 0.15, numPredict: 180 })))
      .filter((item) => item.index < candidates.length)
      .sort((a, b) => b.total - a.total);
  } catch (error) {
    console.warn("[PostCraft] scoring_failed", error instanceof Error ? error.message : "unknown error");
  }

  const ranked = scores.length ? scores.map((item) => candidates[item.index]).filter(Boolean) : candidates;
  console.info(`[PostCraft] angles_ms=${Date.now() - startedAt} candidates=${candidates.length} scoring=${scores.length ? "used" : "fallback"}`);
  return ranked.slice(0, 3);
}

function parsePost(text: string) {
  const parsed = parseJsonObject(text);
  return typeof parsed?.post === "string" ? parsed.post.trim() : "";
}

async function writePost(input: IdeaInput, thesis: string, modeInstruction: string) {
  const prompt = `You are a sharp human writer creating a LinkedIn post for an intelligent professional audience.

Your only job is to make ONE argument clearly and naturally. Do not write generic LinkedIn content.

SELECTED THESIS
${thesis}

STORY EVIDENCE
Topic: ${input.topic}
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

GROUNDING — NON-NEGOTIABLE
- The headline and summary above are the complete evidence set.
- Use only facts explicitly supported by them.
- The selected thesis is an interpretation, not permission to invent supporting facts.
- Every factual claim in the post must be traceable to the supplied headline or summary.
- If the story does not state an outcome, do not state that the outcome is happening.
- Preserve uncertainty: "could" stays "could"; "may" stays "may"; a warning stays a warning.
- Never add job losses, wage stagnation, inequality, social unrest, public reaction, political consequences, market effects, or other outcomes unless they are explicitly present in the supplied story.
- Never invent statistics, examples, quotes, events, people, companies, outcomes, or personal experiences.
- Do not use general knowledge to fill missing context.

WRITING
- 120-180 words.
- 4-7 short paragraphs.
- Start with the insight or tension, not the headline.
- Build one reasoning chain: evidence -> interpretation -> implication.
- The implication must remain conditional if the evidence is conditional.
- Use plain language and varied sentence rhythm.
- Make the selected thesis visible through the reasoning without announcing it.
- End when the thought is complete.
- No heading, title, labels, bullet lists, emojis, or more than two hashtags.
- Never ask the reader a question at the end.

BAD EXAMPLE OF THE KIND OF LEAP TO AVOID:
If the story says AI "could boost the economy but squeeze jobs and wages", do NOT add "social unrest", "the haves and have-nots", "job losses are already being felt", or "millions of workers" unless those facts actually appear above.

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
"What do you think?"
"Agree?"
"Thoughts?"

${modeInstruction}

Return ONLY valid JSON:
{"post":"the finished LinkedIn post"}`;

  const raw = await ask(prompt, { format: "json", temperature: 0.55, numPredict: 400 });
  const post = parsePost(raw);
  if (!post) throw new Error("AI returned an invalid post response");
  return post;
}

export async function generatePostCraftPost(input: IdeaInput, modeInstruction: string) {
  const startedAt = Date.now();
  const thesis = (input.angle || "").trim();
  if (!thesis) throw new Error("A selected angle is required to create a post");

  const post = await writePost(input, thesis, modeInstruction);
  console.info(`[PostCraft] post_ms=${Date.now() - startedAt} mode=${modeInstruction.slice(0, 24)}`);
  return post;
}
