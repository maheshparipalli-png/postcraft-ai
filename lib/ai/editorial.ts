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

Create a compact evidence ledger before anyone tries to find an angle.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

${sourceMaterial}

Extract 6-10 of the most useful pieces of evidence for editorial reasoning.
For each item:
- claim: the concrete fact or reported statement
- support: a short exact or near-exact phrase from the supplied material
- type: fact, interpretation, or uncertainty

RULES
- Do not add facts from memory.
- Preserve attribution and uncertainty.
- Prefer numbers, comparisons, mechanisms, scenarios, decisions, and specific observations.
- Do not create conclusions that are not present in the source.
- If article text is thin or unavailable, rely only on the headline and summary.

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

Find distinct ways of thinking about this exact story. The angle is the product; writing comes later.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

EVIDENCE LEDGER
${ledger}

Generate SIX genuinely different editorial angles.

Every angle MUST have:
1. ONE clear thesis.
2. ONE concrete anchor from the evidence — preferably a number, comparison, mechanism, scenario, decision, or specific detail.
3. ONE real insight: a distinction, contradiction, mechanism, assumption, or implication.
4. A defensible point someone could disagree with.

The thesis must make the reader think: "I hadn't looked at that part of the story that way."

IMPORTANT:
- Do NOT use abstract labels such as "equitable growth", "inclusive growth", "responsible innovation", "the future of work", "AI transformation", or "a crucial question" unless the thesis immediately defines a specific relationship using evidence.
- Do NOT simply say two things happen at once. "X rises while Y falls" is an observation, not an insight. Explain what that relationship means.
- Do NOT manufacture a moral conclusion from economic or social data.
- Do NOT turn "could", "may", "might", "scenario", or "warning" into certainty.
- Do NOT invent consequences, winners, losers, motives, or causal mechanisms.
- A useful angle can be narrower than the headline. Narrow and specific beats dramatic and vague.

Use different reasoning routes across the six:
- hidden mechanism
- surprising distinction
- contradiction inside the evidence
- assumption the evidence challenges
- second-order implication directly supported by the evidence
- practical or strategic consequence explicitly supported by the evidence

Return ONLY JSON:
{"angles":[{"angle":"...","why":"...","evidence":"evidence item numbers and the concrete detail used"}]}`;

  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.5, numPredict: 1000 }));
  const raw = parsed?.angles;
  if (!Array.isArray(raw)) return [];

  return raw.map((item): Angle | null => {
    if (!item || typeof item !== "object") return null;
    const value = item as { angle?: unknown; why?: unknown; evidence?: unknown };
    const angle = typeof value.angle === "string" ? value.angle.trim() : "";
    const why = typeof value.why === "string" ? value.why.trim() : "";
    const evidence = typeof value.evidence === "string" ? value.evidence.trim() : "";
    return angle && why && evidence ? { angle, why, evidence } : null;
  }).filter((item): item is Angle => Boolean(item));
}

async function judgeAngles(story: Story, evidence: Evidence[], angles: Angle[]) {
  const prompt = `You are PostCraft AI's independent editorial judge.

STORY
Headline: ${story.headline}
Summary: ${story.summary}

EVIDENCE
${evidence.map((item, index) => `${index}. ${item.claim} [${item.type}] — ${item.support}`).join("\n")}

CANDIDATES
${angles.map((item, index) => `${index}. THESIS: ${item.angle}\nRATIONALE: ${item.why}\nEVIDENCE ANCHOR: ${item.evidence}`).join("\n\n")}

Score every candidate from 0-10 on:
- grounding
- specificity
- insight
- debate
- usefulness

Reject if:
- it merely summarizes the story;
- it uses an abstract label instead of making a concrete argument;
- it adds an unsupported outcome or causal mechanism;
- it only juxtaposes two facts without explaining their significance;
- it could be written for a random story on the same broad topic.

A strong angle normally contains a concrete anchor plus a precise interpretation of why that anchor matters.

Return ONLY JSON:
{"scores":[{"index":0,"grounding":9,"specificity":9,"insight":8,"debate":8,"usefulness":9,"total":43,"verdict":"keep"}]}`;

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
    }).filter((item): item is NonNullable<typeof item> => Boolean(item && item.index >= 0 && item.index < angles.length && item.verdict === "keep" && item.grounding >= 8 && item.specificity >= 7 && item.insight >= 7));
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
  return ranked.map(({ angle, why, evidence: evidenceAnchor }) => ({ angle, why, evidence: evidenceAnchor }));
}

async function critiquePost(story: Story, evidence: Evidence[], angle: string, post: string) {
  const ledger = evidence.map((item, index) => `${index}. ${item.claim} [${item.type}] — ${item.support}`).join("\n");
  const prompt = `You are PostCraft AI's final post critic. Do not rewrite the post.

THESIS
${angle}

EVIDENCE
${ledger}

POST
${post}

Check:
1. factual claims are supported;
2. uncertainty and attribution are preserved;
3. the post actually argues the selected thesis;
4. it contains at least one concrete evidence detail rather than only abstractions;
5. it does not use generic filler or unsupported moral conclusions.

Return ONLY JSON:
{"pass":true,"reason":"..."}`;
  try {
    const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.05, numPredict: 300 }));
    return parsed?.pass === true;
  } catch {
    return false;
  }
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
- Include at least ONE concrete evidence anchor: a number, comparison, mechanism, scenario, decision, or specific detail from the ledger.
- Do not introduce a new fact merely because it would make the argument stronger.
- Preserve uncertainty and attribution.
- Never invent statistics, examples, quotes, outcomes, personal experiences, or context.
- Do not turn an interpretation into a fact.
- Do not use abstract phrases such as "it's crucial to recognize", "not evenly distributed", "raises a crucial question", "highlights the need", or "strike a balance" unless the sentence immediately makes a specific evidence-based claim.
- Avoid generic LinkedIn filler and rhetorical questions.
- 120-180 words, 4-7 short paragraphs.
- Start with the insight, not the headline.
- End when the thought is complete.

${modeInstruction}

Return ONLY JSON: {"post":"..."}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: attempt === 0 ? 0.55 : 0.35, numPredict: 650 }));
    const post = typeof parsed?.post === "string" ? parsed.post.trim() : "";
    if (post && await critiquePost(story, evidence, angle, post)) return post;
  }

  throw new Error("PostCraft could not produce a sufficiently grounded, specific post from the selected angle. Try another angle.");
}
