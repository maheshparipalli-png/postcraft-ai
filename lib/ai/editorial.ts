import { getAIProvider } from "@/lib/ai/provider";

type Story = { topic: string; headline: string; source: string; summary: string; url?: string };
type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type Angle = { angle: string; why: string; evidence: string };

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
    } catch { return null; }
  }
}

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&#x27;/gi, "'").replace(/\s+/g, " ").trim();
}

function extractArticleBody(html: string) {
  const bodies = [...html.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/gi)].map((m) => { try { return JSON.parse(`"${m[1]}"`); } catch { return ""; } }).filter((v): v is string => typeof v === "string" && v.length > 500);
  if (bodies.length) return bodies.sort((a, b) => b.length - a.length)[0];
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (article) { const text = cleanHtml(article[1]); if (text.length > 500) return text; }
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (main) { const text = cleanHtml(main[1]); if (text.length > 500) return text; }
  return cleanHtml(html);
}

async function fetchArticle(url?: string) {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  try {
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PostCraftAI/1.0)", Accept: "text/html,application/xhtml+xml" }, cache: "no-store", signal: AbortSignal.timeout(12_000), redirect: "follow" });
    if (!response.ok) return "";
    return extractArticleBody(await response.text()).slice(0, 30_000);
  } catch (error) {
    console.warn("[PostCraft] article_fetch_failed", error instanceof Error ? error.message : "unknown error");
    return "";
  }
}

async function buildEvidence(story: Story, articleText: string) {
  const source = articleText ? `FULL ARTICLE TEXT:\n${articleText}` : `HEADLINE:\n${story.headline}\nSUMMARY:\n${story.summary}`;
  const prompt = `You are PostCraft AI's evidence extraction engine. Build an evidence ledger before generating any opinion.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

${source}

Extract 6-10 useful evidence items. For each return claim, support, and type (fact, interpretation, uncertainty).
Rules:
- Use ONLY the supplied material.
- Preserve attribution and uncertainty.
- Prefer numbers, comparisons, mechanisms, scenarios, decisions and specific details.
- Never turn an interpretation into a fact.
- Never add outside knowledge.

Return ONLY JSON: {"evidence":[{"claim":"...","support":"...","type":"fact"}]}`;
  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.1, numPredict: 800 }));
  if (!Array.isArray(parsed?.evidence)) return [];
  return parsed.evidence.map((item): Evidence | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { claim?: unknown; support?: unknown; type?: unknown };
    const claim = typeof v.claim === "string" ? v.claim.trim() : "";
    const support = typeof v.support === "string" ? v.support.trim() : "";
    const type = v.type === "fact" || v.type === "interpretation" || v.type === "uncertainty" ? v.type : "fact";
    return claim && support ? { claim, support, type } : null;
  }).filter((x): x is Evidence => Boolean(x)).slice(0, 10);
}

async function generateAngles(story: Story, evidence: Evidence[]) {
  const ledger = evidence.map((e, i) => `${i}. ${e.type.toUpperCase()}\nClaim: ${e.claim}\nSupport: ${e.support}`).join("\n\n");
  const prompt = `You are PostCraft AI's editorial ideation engine. The product promise is: "Find something worth saying."

Find the strongest specific argument hidden inside this exact story. Do not merely summarize it.

STORY
${story.headline}
${story.source}

EVIDENCE LEDGER
${ledger}

Generate SIX genuinely different angles. Every angle must contain:
1. A thesis someone could agree or disagree with.
2. A concrete evidence anchor from the ledger — ideally a number, comparison, mechanism, scenario, decision, or specific detail.
3. An interpretation of why that detail matters.

QUALITY BAR
- Prefer: "GDP could rise 32.4%, but labor's share falls to 45.2%" over "AI may increase inequality."
- Prefer a precise relationship over an abstract category.
- The thesis should make the reader see a part of the story differently.
- Narrow and specific beats dramatic and vague.
- If the source gives a scenario, keep it explicitly a scenario.
- If the source attributes a claim, keep the attribution.

HARD REJECTIONS
- Do not use labels such as equitable growth, inclusive growth, responsible innovation, future of work, AI transformation, winner-takes-all, or inequality as the thesis unless the sentence immediately defines the exact evidence-based relationship.
- Do not say "X could be a result of Y" unless the source explicitly establishes Y as the mechanism.
- Do not invent causes, motives, winners, losers, policy outcomes or consequences.
- Do not use "while X, Y" as the whole insight. Explain what the relationship means.
- Do not add facts from general knowledge.

Useful reasoning routes: contradiction inside the evidence; surprising distinction; challenged assumption; mechanism explicitly supported; second-order implication directly supported; practical consequence explicitly supported.

For each angle, evidence must name the ledger item number and concrete detail used.

Return ONLY JSON: {"angles":[{"angle":"one-sentence thesis","why":"why this changes how the reader sees the story","evidence":"item 0 + exact detail"}]}`;
  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.45, numPredict: 1200 }));
  if (!Array.isArray(parsed?.angles)) return [];
  return parsed.angles.map((item): Angle | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { angle?: unknown; why?: unknown; evidence?: unknown };
    const angle = typeof v.angle === "string" ? v.angle.trim() : "";
    const why = typeof v.why === "string" ? v.why.trim() : "";
    const evidenceAnchor = typeof v.evidence === "string" ? v.evidence.trim() : "";
    return angle && why && evidenceAnchor ? { angle, why, evidence: evidenceAnchor } : null;
  }).filter((x): x is Angle => Boolean(x));
}

async function judgeAngles(story: Story, evidence: Evidence[], angles: Angle[]) {
  const prompt = `You are PostCraft AI's strict editorial judge. Keep only angles that are genuinely worth saying.

STORY: ${story.headline}

EVIDENCE
${evidence.map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`).join("\n")}

CANDIDATES
${angles.map((a, i) => `${i}. THESIS: ${a.angle}\nWHY: ${a.why}\nANCHOR: ${a.evidence}`).join("\n\n")}

Score 0-10 for grounding, specificity, insight, debate and usefulness.
Reject any candidate that:
- is just a summary;
- uses an abstract label instead of an argument;
- invents a causal mechanism;
- uses a causal phrase like "winner-takes-all" without explicit source support;
- merely says two facts coexist;
- could fit almost any AI/business story;
- has no concrete number, comparison, mechanism, scenario, decision or specific detail.

The best angle should be expressible as a precise sentence such as: "The striking part is not X; it is Y, as shown by Z." It must stay faithful to the source.

Return ONLY JSON: {"scores":[{"index":0,"grounding":9,"specificity":9,"insight":9,"debate":8,"usefulness":9,"total":44,"verdict":"keep"}]}`;
  try {
    const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.05, numPredict: 800 }));
    if (!Array.isArray(parsed?.scores)) return [];
    return parsed.scores.map((item) => {
      if (!item || typeof item !== "object") return null;
      const v = item as Record<string, unknown>;
      const index = typeof v.index === "number" ? v.index : -1;
      const grounding = typeof v.grounding === "number" ? v.grounding : 0;
      const specificity = typeof v.specificity === "number" ? v.specificity : 0;
      const insight = typeof v.insight === "number" ? v.insight : 0;
      const debate = typeof v.debate === "number" ? v.debate : 0;
      const usefulness = typeof v.usefulness === "number" ? v.usefulness : 0;
      const total = typeof v.total === "number" ? v.total : grounding + specificity + insight + debate + usefulness;
      return { index, grounding, specificity, insight, debate, usefulness, total, verdict: v.verdict === "keep" ? "keep" : "reject" };
    }).filter((x) => x.index >= 0 && x.index < angles.length && x.verdict === "keep" && x.grounding >= 8 && x.specificity >= 8 && x.insight >= 8);
  } catch (error) {
    console.warn("[PostCraft] editorial_judge_failed", error instanceof Error ? error.message : "unknown error");
    return [];
  }
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now();
  const articleText = await fetchArticle(story.url);
  const evidence = await buildEvidence(story, articleText);
  if (evidence.length < 3) throw new Error("PostCraft could not extract enough reliable evidence from this story. Try opening the source or choose another story.");
  const angles = await generateAngles(story, evidence);
  if (!angles.length) throw new Error("PostCraft could not find useful editorial angles in this story.");
  const judged = await judgeAngles(story, evidence, angles);
  const ranked = judged.sort((a, b) => b.total - a.total).map((x) => angles[x.index]).filter(Boolean).slice(0, 3);
  if (!ranked.length) throw new Error("PostCraft found evidence, but none of the generated angles met its editorial standard. Try another story.");
  console.info(`[PostCraft] editorial_ms=${Date.now() - startedAt} article=${articleText.length > 0} evidence=${evidence.length} angles=${angles.length} returned=${ranked.length}`);
  return ranked.map(({ angle, why, evidence: evidenceAnchor }) => ({ angle, why, evidence: evidenceAnchor }));
}

async function critiquePost(evidence: Evidence[], angle: string, post: string) {
  const ledger = evidence.map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`).join("\n");
  const prompt = `You are PostCraft AI's final quality gate. Do not rewrite.

THESIS\n${angle}\n\nEVIDENCE\n${ledger}\n\nPOST\n${post}

Return pass=true ONLY if: every factual claim is supported; scenario/attribution language is preserved; the post actually argues the thesis; it contains a concrete evidence anchor; and it avoids generic filler, unsupported causal claims and vague moral conclusions.

Return ONLY JSON: {"pass":true,"reason":"..."}`;
  try {
    const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.05, numPredict: 350 }));
    return parsed?.pass === true;
  } catch { return false; }
}

export async function generateEditorialPost(story: Story, angle: string, angleWhy: string, modeInstruction: string) {
  const articleText = await fetchArticle(story.url);
  const evidence = await buildEvidence(story, articleText);
  if (evidence.length < 3) throw new Error("PostCraft could not recover enough evidence to safely write this post. Try the source again.");
  const ledger = evidence.map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`).join("\n");
  const prompt = `You are PostCraft AI's final writer. Write a LinkedIn post that develops ONE precise thesis from evidence.

STORY
${story.headline}
${story.source}

EVIDENCE LEDGER
${ledger}

SELECTED THESIS
${angle}

WHY THIS ANGLE WORKS
${angleWhy}

WRITING METHOD
Evidence -> observation -> interpretation -> implication. Do not skip the evidence step.

NON-NEGOTIABLES
- Include at least one concrete anchor from the ledger, preferably a number, comparison, mechanism or scenario.
- If using a scenario, say it is a scenario or model; never present it as a forecast or fact.
- Do not introduce facts, examples, quotes, experiences or context outside the ledger.
- Do not strengthen "could/may/might" into certainty.
- Do not use empty phrases such as "it's crucial to recognize", "not evenly distributed", "highlights the need", "raises a crucial question", "strike a balance", "in today's rapidly changing world", or "the future is...".
- Do not end with a generic call for policymakers, leaders or society unless the thesis specifically requires it and the evidence supports it.
- Start with the actual insight, not the headline.
- Plain language. No corporate jargon. No rhetorical question as a substitute for a point.
- 120-180 words, 4-7 short paragraphs.

${modeInstruction}

Return ONLY JSON: {"post":"..."}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const result = parseJson(await provider().generateText(prompt + (attempt ? "\n\nThe previous draft failed quality control. Make the argument more concrete and evidence-led." : ""), { format: "json", temperature: attempt ? 0.25 : 0.55, numPredict: 650 }));
    const post = typeof result?.post === "string" ? result.post.trim() : "";
    if (post && await critiquePost(evidence, angle, post)) return post;
  }
  throw new Error("PostCraft could not produce a sufficiently grounded, specific post from the selected angle. Try another angle.");
}
