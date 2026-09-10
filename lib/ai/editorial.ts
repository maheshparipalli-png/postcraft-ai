import { getAIProvider } from "@/lib/ai/provider";

type Story = {
  topic: string;
  headline: string;
  source: string;
  summary: string;
  url?: string;
};

type Evidence = {
  claim: string;
  support: string;
  type: "fact" | "interpretation" | "uncertainty";
};

type Angle = {
  angle: string;
  why: string;
  evidence: string;
};

const provider = () => getAIProvider();

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const value = JSON.parse(match[0]);
      return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }
}

function cleanHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractArticleBody(html: string) {
  const jsonLdBodies = [...html.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/gi)]
    .map((match) => {
      try { return JSON.parse(`"${match[1]}"`); } catch { return ""; }
    })
    .filter((value): value is string => typeof value === "string" && value.length > 500);

  if (jsonLdBodies.length) return jsonLdBodies.sort((a, b) => b.length - a.length)[0];

  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (articleMatch) {
    const text = cleanHtml(articleMatch[1]);
    if (text.length > 500) return text;
  }

  const mainMatch = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    const text = cleanHtml(mainMatch[1]);
    if (text.length > 500) return text;
  }

  return cleanHtml(html);
}

async function fetchArticle(url?: string) {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PostCraftAI/1.0; +https://github.com/maheshparipalli-png/postcraft-ai)",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!response.ok) return "";
    const html = await response.text();
    return extractArticleBody(html).slice(0, 30_000);
  } catch (error) {
    console.warn("[PostCraft] article_fetch_failed", error instanceof Error ? error.message : "unknown error");
    return "";
  }
}

async function buildEvidence(story: Story, articleText: string) {
  const sourceMaterial = articleText
    ? `FULL ARTICLE TEXT:\n${articleText}`
    : `HEADLINE:\n${story.headline}\nSUMMARY:\n${story.summary}`;

  const prompt = `You are PostCraft AI's evidence extraction engine.

Your job is to create a compact evidence ledger before anyone tries to find an angle.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

${sourceMaterial}

Extract 6-10 of the most useful pieces of evidence for editorial reasoning.
For each item:
- claim: the concrete fact or reported statement
- support: a short exact or near-exact phrase from the supplied material that supports it
- type: fact, interpretation, or uncertainty

RULES
- Do not add facts from memory.
- Do not turn a prediction, scenario, warning, or possibility into a fact.
- Preserve attribution: if the source says a company/researcher/government believes something, keep that attribution.
- Prefer numbers, comparisons, mechanisms, scenarios, decisions, and specific observations over broad summaries.
- Do not create conclusions that are not present in the source.
- If the article text is thin or unavailable, rely only on the headline and summary.

Return ONLY JSON:
{"evidence":[{"claim":"...","support":"...","type":"fact"}]}`;

  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.1, numPredict: 700 }));
  const raw = parsed?.evidence;
  if (!Array.isArray(raw)) return [];

  return raw.map((item): Evidence | null => {
    if (!item || typeof item !== "object") return null;
    const value = item as { claim?: unknown; support?: unknown; type?: unknown };
    const claim = typeof value.claim === "string" ? value.claim.trim() : "";
    const support = typeof value.support === "string" ? value.support.trim() : "";
    const type = value.type === "fact" || value.type === "interpretation" || value.type === "uncertainty" ? value.type : "fact";
    return claim && support ? { claim, support, type } : null;
  }).filter((item): item is Evidence => Boolean(item)).slice(0, 10);
}

async function generateAngles(story: Story, evidence: Evidence[]) {
  const ledger = evidence.map((item, index) => `${index}. ${item.type.toUpperCase()}\nClaim: ${item.claim}\nSupport: ${item.support}`).join("\n\n");

  const prompt = `You are PostCraft AI's editorial ideation engine.

Product promise: "Find something worth saying."

You are given an evidence ledger, not just a topic. Your job is to find distinct ways of thinking about this exact story.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

EVIDENCE LEDGER
${ledger}

Generate SIX genuinely different editorial angles. Each angle must contain:
1. a precise thesis,
2. a real tension, distinction, contradiction, mechanism, or implication,
3. a concrete connection to one or more evidence items.

Use different reasoning routes across the six:
- hidden mechanism
- surprising distinction
- second-order implication that is directly supported
- contradiction inside the evidence
- assumption the evidence challenges
- practical or strategic consequence that is explicitly supported

GROUNDING
- Every important factual premise must be traceable to the evidence ledger.
- Interpretation is allowed; invented facts are not.
- A plausible consequence is NOT enough. If the evidence does not support it, do not use it.
- Preserve uncertainty and attribution.
- Never manufacture job losses, inequality, wage effects, social unrest, political consequences, market effects, winners/losers, or other second-order effects unless the evidence explicitly supports them.

QUALITY
- Do not paraphrase the headline.
- Do not produce generic "benefits vs risks" or "we need balance" arguments.
- Do not simply combine two facts with "while" and call that insight.
- Do not use a thesis that could fit a random story on the same topic.
- Prefer a narrow, surprising, defensible observation over a dramatic speculative one.
- The reader should learn a way of seeing the story, not merely what happened.

Return ONLY JSON:
{"angles":[{"angle":"...","why":"...","evidence":"evidence item numbers supporting the angle"}]}`;

  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.55, numPredict: 900 }));
  const raw = parsed?.angles;
  if (!Array.isArray(raw)) return [];

  return raw.map((item): Angle | null => {
    if (!item || typeof item !== "object") return null;
    const value = item as { angle?: unknown; why?: unknown; evidence?: unknown };
    const angle = typeof value.angle === "string" ? value.angle.trim() : "";
    const why = typeof value.why === "string" ? value.why.trim() : "";
    const evidence = typeof value.evidence === "string" ? value.evidence.trim() : "";
    return angle && why ? { angle, why, evidence } : null;
  }).filter((item): item is Angle => Boolean(item));
}

async function judgeAngles(story: Story, evidence: Evidence[], angles: Angle[]) {
  const prompt = `You are PostCraft AI's independent editorial judge.

STORY
Headline: ${story.headline}
Summary: ${story.summary}

EVIDENCE
${evidence.map((item, index) => `${index}. ${item.claim} [${item.type}]`).join("\n")}

CANDIDATES
${angles.map((item, index) => `${index}. THESIS: ${item.angle}\nRATIONALE: ${item.why}\nEVIDENCE REFERENCE: ${item.evidence}`).join("\n\n")}

Score each candidate from 0-10 on:
- grounding: important premises are supported by the evidence
- specificity: this exact story is required
- insight: reveals a meaningful relationship or distinction
- debate: intelligent readers could disagree
- usefulness: gives a professional something substantive to say

Reject candidates that merely summarize the story, invent consequences, or rely on plausible-but-unsupported assumptions.
A safe generic thesis is not better than a sharper supported thesis.

Return ONLY JSON:
{"scores":[{"index":0,"grounding":8,"specificity":9,"insight":8,"debate":7,"usefulness":8,"total":40,"verdict":"keep"}]}`;

  try {
    const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.05, numPredict: 700 }));
    const raw = parsed?.scores;
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as { index?: unknown; total?: unknown; grounding?: unknown; specificity?: unknown; insight?: unknown; debate?: unknown; usefulness?: unknown; verdict?: unknown };
      if (typeof value.index !== "number") return null;
      return {
        index: value.index,
        total: typeof value.total === "number" ? value.total : 0,
        grounding: typeof value.grounding === "number" ? value.grounding : 0,
        specificity: typeof value.specificity === "number" ? value.specificity : 0,
        insight: typeof value.insight === "number" ? value.insight : 0,
        debate: typeof value.debate === "number" ? value.debate : 0,
        usefulness: typeof value.usefulness === "number" ? value.usefulness : 0,
        verdict: value.verdict === "keep" ? "keep" : "reject",
      };
    }).filter((item): item is NonNullable<typeof item> => Boolean(item && item.index >= 0 && item.index < angles.length && item.verdict === "keep" && item.grounding >= 7));
  } catch (error) {
    console.warn("[PostCraft] editorial_judge_failed", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now();
  const articleText = await fetchArticle(story.url);
  const evidence = await buildEvidence(story, articleText);
  if (evidence.length < 3) {
    throw new Error("PostCraft could not extract enough reliable evidence from this story. Try opening the source or choose another story.");
  }

  const angles = await generateAngles(story, evidence);
  if (!angles.length) throw new Error("PostCraft could not find useful editorial angles in this story.");

  const judged = await judgeAngles(story, evidence, angles);
  const ranked = judged
    .sort((a, b) => b.total - a.total)
    .map((item) => angles[item.index])
    .filter(Boolean)
    .slice(0, 3);

  if (!ranked.length) {
    throw new Error("PostCraft found evidence, but none of the generated angles met its editorial standard. Try another story.");
  }

  console.info(`[PostCraft] editorial_ms=${Date.now() - startedAt} article=${articleText.length > 0} evidence=${evidence.length} angles=${angles.length} returned=${ranked.length}`);
  return ranked.map(({ angle, why }) => ({ angle, why }));
}

export async function generateEditorialPost(story: Story, angle: string, angleWhy: string, modeInstruction: string) {
  const articleText = await fetchArticle(story.url);
  const evidence = await buildEvidence(story, articleText);
  if (evidence.length < 3) throw new Error("PostCraft could not recover enough evidence to safely write this post. Try the source again.");

  const ledger = evidence.map((item, index) => `${index}. ${item.claim} [${item.type}] — ${item.support}`).join("\n");
  const prompt = `You are PostCraft AI's final writer.

Write a LinkedIn post around ONE selected thesis.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

EVIDENCE LEDGER
${ledger}

SELECTED THESIS
${angle}

WHY IT WORKS
${angleWhy}

RULES
- The evidence ledger is the complete factual source.
- Develop the thesis through evidence -> observation -> insight -> implication.
- Do not introduce a new fact merely because it would make the argument stronger.
- Preserve uncertainty and attribution.
- Never invent statistics, examples, quotes, outcomes, personal experiences, or context.
- Do not turn an interpretation into a fact.
- Avoid generic LinkedIn filler and rhetorical questions.
- 120-180 words, 4-7 short paragraphs.
- Start with the insight, not "I read an article" or the headline.
- End when the thought is complete.

${modeInstruction}

Return ONLY JSON: {"post":"..."}`;

  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.6, numPredict: 650 }));
  const post = typeof parsed?.post === "string" ? parsed.post.trim() : "";
  if (!post) throw new Error("PostCraft could not produce a grounded post from the selected angle.");
  return post;
}
