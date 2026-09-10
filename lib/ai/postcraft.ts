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

const genericEvidencePattern = /comprehensive, up-to-date news coverage, aggregated from sources all over the world by google news/i;
const unsupportedLeapPatterns = [
  /social unrest/i,
  /inequality|unequal(?:ly)? distributed|not evenly distributed/i,
  /job losses|lost jobs|workers (?:are|were|will be) left/i,
  /wage stagnation|stagnant wages|reduced wages|lower wages|wages (?:fall|decline|drop)/i,
  /individual livelihoods?|livelihoods? (?:are|will be|face)/i,
  /the majority of workers/i,
  /the haves and have-nots/i,
  /social contract/i,
  /millions of (?:workers|people|employees)/i,
  /public reaction/i,
  /political consequences?/i,
  /market consequences?/i,
  /corporations? (?:will|are) (?:benefit|win)/i,
  /investors? (?:will|are) (?:benefit|win)/i,
  /automation and augmentation/i,
];

const genericThesisPatterns = [
  /benefits? (?:vs\.?|versus|and) (?:costs?|risks?)/i,
  /trade[- ]off between .*benefits? .* (?:jobs?|livelihoods?|wages?)/i,
  /trade[- ]off between .*economic .* (?:individual|worker) (?:benefits?|outcomes?|livelihoods?)/i,
  /economic (?:growth|benefits?) .* (?:individual|worker) livelihoods?/i,
  /(?:economic|overall) benefits? .* (?:come|comes) with .* (?:cost|risk)/i,
];

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

function hasUsableEvidence(input: IdeaInput) {
  const summary = input.summary.trim();
  return summary.length >= 80 && !genericEvidencePattern.test(summary);
}

function containsUnsupportedLeap(value: string, input: IdeaInput) {
  const source = `${input.headline} ${input.summary}`;
  return unsupportedLeapPatterns.some((pattern) => pattern.test(value) && !pattern.test(source));
}

function isGenericThesis(value: string) {
  return genericThesisPatterns.some((pattern) => pattern.test(value));
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
  if (!hasUsableEvidence(input)) return null;

  const prompt = `You are the editorial reasoning engine inside PostCraft AI.

The product promise is: "help me find something worth saying."

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Source: ${input.source}
Summary: ${input.summary}

EDITORIAL LENS
${lens}

Do this privately in five steps:
1. Select ONE exact detail or short phrase explicitly present in the headline or summary.
2. State the factual observation that detail supports.
3. Identify an unexpected relationship, tension, contradiction, trade-off, or distinction that follows from that observation.
4. Turn that insight into ONE specific, debatable thesis.
5. Explain why the thesis follows from the evidence.

GROUNDING IS STRICT:
- The headline and summary are the complete evidence set. You know nothing else about this story.
- The evidence field MUST quote wording from the supplied headline or summary.
- The observation may only restate or carefully interpret what that evidence supports.
- The thesis may go beyond the headline's wording, but it must NOT introduce a new event, consequence, group, statistic, outcome, example, or causal claim that the story does not support.
- Do NOT infer social unrest, inequality, unequal distribution of benefits, job losses, wage stagnation, public reaction, political consequences, market consequences, corporate/investor winners, or other second-order effects unless the supplied story explicitly supports them.
- Never turn a "could", "may", "might", "warns", or "possible" claim into an established fact.
- If the story is too thin to support an interesting argument, return empty strings rather than inventing context.
- Do not use outside knowledge to make a thin story sound deeper.

QUALITY — THIS IS CRITICAL:
- The thesis MUST reveal something beyond simply repeating or paraphrasing the headline.
- A generic "benefits vs costs" statement is NOT an angle.
- A generic "AI is changing jobs" statement is NOT an angle.
- A generic "we need to balance innovation and risk" statement is NOT an angle.
- Do not turn two facts from the headline into a fake condition such as "X is good only if Y outweighs Z" unless the story explicitly establishes that condition.
- Reject generic formulations such as "the benefits come at a cost", "a trade-off between economic growth and livelihoods", or "economic benefits versus worker costs". Those merely rename two facts; they do not reveal a useful relationship.
- Prefer a precise distinction, tension, mechanism, contradiction, hidden trade-off, or implication that is genuinely supported by the evidence.
- The reader should learn a way of looking at the story, not merely hear the story again.
- The thesis must be specific enough that it could not have been written for a random story about the same broad topic.
- One clear claim. Debatable without becoming speculative.

A useful mental test: if the thesis could be written without seeing this exact headline and summary, reject it.

Return ONLY this JSON object:
{"evidence":"exact short phrase from the headline or summary","observation":"one factual observation or careful interpretation grounded in that evidence","angle":"one non-obvious, precise, debatable thesis that goes beyond the headline without adding unsupported facts","why":"one sentence explaining exactly how the thesis follows from the evidence"}`;

  try {
    const parsed = parseJsonObject(await ask(prompt, { format: "json", temperature: 0.35, numPredict: 300 }));
    const evidence = typeof parsed?.evidence === "string" ? parsed.evidence.trim() : "";
    const observation = typeof parsed?.observation === "string" ? parsed.observation.trim() : "";
    const angle = typeof parsed?.angle === "string" ? parsed.angle.trim() : "";
    const why = typeof parsed?.why === "string" ? parsed.why.trim() : "";

    if (
      !evidence ||
      !observation ||
      !angle ||
      !why ||
      !isGroundedEvidence(evidence, input) ||
      containsUnsupportedLeap(angle, input) ||
      containsUnsupportedLeap(why, input) ||
      isGenericThesis(angle)
    ) return null;

    return { evidence, observation, angle, why };
  } catch (error) {
    console.warn("[PostCraft] candidate_failed", error instanceof Error ? error.message : "unknown error");
    return null;
  }
}

export async function generatePostCraftAngles(input: IdeaInput) {
  const startedAt = Date.now();
  if (!hasUsableEvidence(input)) {
    throw new Error("This story does not contain enough reliable article evidence for PostCraft to build a grounded angle. Try another story.");
  }

  const lenses = [
    "Look for the most surprising mechanism or scenario actually supported by the story. What does the evidence reveal that the headline makes easy to miss?",
    "Look for the strongest trade-off explicitly supported by the story: what becomes easier, harder, more valuable, or less valuable at the same time?",
    "Look for a mismatch between the obvious headline interpretation and a specific detail in the story. What distinction would make the story more interesting without adding facts?",
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

  const scoringPrompt = `You are the final editorial judge for PostCraft AI.

The product promise is: "help me find something worth saying."

STORY EVIDENCE
Headline: ${input.headline}
Summary: ${input.summary}

CANDIDATES
${candidates.map((item, index) => `${index}. EVIDENCE: ${item.evidence}\nOBSERVATION: ${item.observation}\nTHESIS: ${item.angle}\nWHY: ${item.why}`).join("\n\n")}

Score every candidate from 0-10 on:
1. evidence_grounding — could every important part of the thesis reasonably be traced to the supplied headline/summary?
2. specificity — is it about this exact story rather than the topic generally?
3. tension — is there a real trade-off, contradiction, hidden cost, distinction, or conditional consequence?
4. debatability — could an intelligent reader reasonably disagree?
5. originality — does it reveal a useful way of seeing the story instead of restating the headline?

EDITORIAL STANDARD:
- A candidate that merely paraphrases the headline should score 0-3 for originality.
- A generic "benefits vs costs" or "we need balance" framing should score 0-3 for originality.
- A candidate that merely says economic growth has benefits while workers face risks should score 0-3 for originality unless it identifies a more precise relationship supported by the evidence.
- A candidate that invents a condition such as "X is good only if Y outweighs Z" when the story does not establish that condition should score 0-3 for grounding.
- A candidate that adds social unrest, inequality, unequal distribution, job losses, wage effects, public reaction, political consequences, market effects, corporate/investor winners, or other outcomes not present in the story should score 0-2 for evidence_grounding.
- Do not reward a candidate merely because an added consequence sounds plausible.
- Prefer a narrower, fully supported thesis with a real insight over a dramatic but speculative thesis.
- The best candidate should make the reader see a relationship or distinction they would not get by simply reading the headline.

TOTAL is the sum of the five scores. Candidates with total below 32 should be treated as weak and should not be returned when a stronger candidate exists.

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

  if (scores.length) {
    const strong = scores.filter((item) => item.total >= 32);
    const ranked = (strong.length ? strong : scores.slice(0, 1))
      .map((item) => candidates[item.index])
      .filter(Boolean);
    console.info(`[PostCraft] angles_ms=${Date.now() - startedAt} candidates=${candidates.length} scoring=used strong=${strong.length}`);
    return ranked.slice(0, 3);
  }

  console.info(`[PostCraft] angles_ms=${Date.now() - startedAt} candidates=${candidates.length} scoring=fallback`);
  return candidates.slice(0, 3);
}

function parsePost(text: string) {
  const parsed = parseJsonObject(text);
  return typeof parsed?.post === "string" ? parsed.post.trim() : "";
}

async function writePost(input: IdeaInput, thesis: string, modeInstruction: string) {
  if (!hasUsableEvidence(input)) {
    throw new Error("This story does not contain enough reliable article evidence to safely write a grounded post.");
  }
  if (containsUnsupportedLeap(thesis, input) || isGenericThesis(thesis)) {
    throw new Error("The selected angle is not sufficiently specific or grounded. Please choose another angle.");
  }

  const prompt = `You are a sharp human writer creating a LinkedIn post for an intelligent professional audience.

Your only job is to develop ONE argument clearly and naturally. Do not write generic LinkedIn content.

SELECTED THESIS
${thesis}

STORY EVIDENCE
Topic: ${input.topic}
Headline: ${input.headline}
Summary: ${input.summary}

GROUNDING — NON-NEGOTIABLE
- The headline and summary above are the complete evidence set.
- Use only facts explicitly supported by them.
- The selected thesis is an interpretation, not permission to invent supporting facts.
- Every factual claim in the post must be traceable to the supplied headline or summary.
- If the story does not state an outcome, do not state that the outcome is happening.
- Preserve uncertainty: "could" stays "could"; "may" stays "may"; a warning stays a warning.
- Never add job losses, wage stagnation, inequality, unequal distribution of benefits, social unrest, public reaction, political consequences, market effects, corporate/investor winners, or other outcomes unless they are explicitly present in the supplied story.
- Never invent statistics, examples, quotes, events, people, companies, outcomes, or personal experiences.
- Do not use general knowledge to fill missing context.

ARGUMENT QUALITY
- Do not merely restate the selected thesis in different words.
- Develop the thesis through reasoning: evidence -> observation -> insight -> implication.
- The post should contain a genuine distinction, tension, contradiction, trade-off, or implication that is supported by the story.
- Make the reader see why the evidence is more interesting than the obvious headline interpretation.
- If the thesis is conditional, preserve that condition. Do not turn possibility into fact.
- Never manufacture drama to make the post interesting. Make it interesting by thinking clearly.

WRITING
- 120-180 words.
- 4-7 short paragraphs.
- Start with the insight or tension, not the headline.
- Build one coherent reasoning chain rather than listing observations.
- Use plain language and varied sentence rhythm.
- Make the selected thesis visible through the reasoning without announcing it.
- End when the thought is complete.
- No heading, title, labels, bullet lists, emojis, or more than two hashtags.
- Never ask the reader a question at the end.

BAD EXAMPLE OF THE KIND OF LEAP TO AVOID:
If the story says AI "could boost the economy but squeeze jobs and wages", do NOT add "social unrest", "the haves and have-nots", "job losses are already being felt", "reduced wages", or "millions of workers" unless those facts actually appear above.

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
  if (containsUnsupportedLeap(post, input)) {
    throw new Error("AI produced a post with an unsupported factual leap. Please regenerate or choose another story.");
  }
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
