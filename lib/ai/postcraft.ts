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

type Evidence = {
  fact: string;
  significance: string;
};

type Thesis = {
  angle: string;
  why: string;
  evidence: string;
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

function normalizeEvidence(items: Evidence[]) {
  return Array.from(
    new Map(items.map((item) => [normalizeText(item.fact), item])).values()
  );
}

function normalizeTheses(items: Thesis[]) {
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

async function extractEvidence(input: IdeaInput, lens: string): Promise<Evidence | null> {
  const prompt = `You are the evidence analyst inside PostCraft AI.

Your job is NOT to generate an opinion. Your job is to find one useful piece of evidence already present in the supplied story.

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Source: ${input.source}
Summary: ${input.summary || "No reliable summary was supplied."}

LENS
${lens}

Find ONE concrete fact, claim, comparison, mechanism, scenario, or detail explicitly present in the supplied story.
Then explain why that detail could matter editorially, without adding outside facts.

Rules:
- Do not infer facts that are not stated.
- Do not use general knowledge about AI, economics, jobs, politics, or the topic.
- Do not turn the headline into a fact unless the summary supports it.
- The significance may be an interpretation, but it must follow directly from the fact.

Return ONLY:
{"fact":"specific detail from the story","significance":"why this detail creates an interesting tension or implication"}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = parseJsonObject(await ask(prompt));
    const fact = typeof parsed?.fact === "string" ? parsed.fact.trim() : "";
    const significance = typeof parsed?.significance === "string" ? parsed.significance.trim() : "";
    if (fact) return { fact, significance };
  }

  return null;
}

async function generateThesisFromEvidence(
  input: IdeaInput,
  evidence: Evidence,
  lens: string
): Promise<Thesis | null> {
  const prompt = `You are the thesis editor inside PostCraft AI.

The product promise is: "help me find something worth saying."

STORY
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

EVIDENCE FROM THE STORY
Fact: ${evidence.fact}
Why it may matter: ${evidence.significance}

EDITORIAL LENS
${lens}

Turn ONLY this evidence into ONE precise, debatable thesis.

A strong thesis:
- makes one claim rather than summarizing;
- contains tension, contradiction, trade-off, hidden cost, or second-order consequence;
- is specific to this evidence;
- could be challenged by an intelligent reader;
- does not require any fact outside the story.

Reject generic claims about AI risks, benefits, jobs, innovation, balance, responsible AI, oversight, or critical thinking unless the supplied evidence makes that exact claim unavoidable.
Do not introduce a new industry, profession, company, statistic, event, or consequence that is absent from the evidence.

Return ONLY:
{"angle":"one specific debatable thesis","why":"why this thesis follows from the evidence","evidence":"the exact story detail supporting it"}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = parseJsonObject(await ask(prompt));
    const angle = typeof parsed?.angle === "string" ? parsed.angle.trim() : "";
    const why = typeof parsed?.why === "string" ? parsed.why.trim() : "";
    const supportingEvidence = typeof parsed?.evidence === "string" ? parsed.evidence.trim() : "";
    if (angle && supportingEvidence) {
      return { angle, why, evidence: supportingEvidence };
    }
  }

  return null;
}

export async function generatePostCraftAngles(input: IdeaInput) {
  const evidenceLenses = [
    "Look for the most surprising concrete mechanism or scenario in the story.",
    "Look for a trade-off: what becomes easier, faster, cheaper, harder, riskier, or less valuable according to the story?",
    "Look for a mismatch between the headline's obvious interpretation and a specific detail in the story.",
  ];

  const evidenceResults: Evidence[] = [];
  for (const lens of evidenceLenses) {
    const evidence = await extractEvidence(input, lens);
    if (evidence) evidenceResults.push(evidence);
  }

  const evidence = normalizeEvidence(evidenceResults);
  if (evidence.length < 2) {
    throw new Error("AI could not extract enough grounded evidence from this story; please try again");
  }

  const thesisLenses = [
    "Find the hidden cost or unintended consequence.",
    "Find the strongest contradiction or trade-off.",
    "Find the second-order consequence that changes how the story should be interpreted.",
  ];

  const thesisResults: Thesis[] = [];
  for (let index = 0; index < evidence.length; index += 1) {
    const thesis = await generateThesisFromEvidence(
      input,
      evidence[index],
      thesisLenses[index % thesisLenses.length]
    );
    if (thesis) thesisResults.push(thesis);
  }

  const candidates = normalizeTheses(thesisResults);
  if (candidates.length < 2) {
    throw new Error("AI could not produce enough evidence-grounded thesis candidates; please try again");
  }

  const scoringPrompt = `You are the final thesis judge for PostCraft AI.

STORY
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}

CANDIDATES
${candidates.map((item, index) => `${index}. THESIS: ${item.angle}\nWHY: ${item.why}\nEVIDENCE: ${item.evidence}`).join("\n\n")}

Score every candidate from 0-10 on:
1. evidence_grounding — can the thesis be supported directly by the supplied evidence?
2. specificity — is it about this story rather than AI in general?
3. tension — does it contain a meaningful contradiction, trade-off, hidden cost, or second-order effect?
4. debatability — could a smart reader reasonably disagree?
5. originality — does it avoid the obvious first interpretation?

TOTAL is the sum of those five scores.
A thesis that introduces information not present in the story should score near zero on evidence_grounding and should not rank highly.

Return ONLY:
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
