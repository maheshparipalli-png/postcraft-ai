import { getAIProvider } from "@/lib/ai/provider";

type Story = { topic: string; headline: string; source: string; summary: string; url?: string };
export type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type Angle = { angle: string; why: string; evidence: string };

const provider = () => getAIProvider();

function parseJson(text: string): Record<string, unknown> | null {
  try { const value = JSON.parse(text); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
  catch { const match = text.match(/\{[\s\S]*\}/); if (!match) return null; try { const value = JSON.parse(match[0]); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; } catch { return null; } }
}

function cleanHtml(html: string) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&#x27;/gi, "'").replace(/\s+/g, " ").trim();
}

function extractArticleBody(html: string) {
  const bodies = [...html.matchAll(/"articleBody"\s*:\s*"((?:\\.|[^"\\])*)"/gi)].map((m) => { try { return JSON.parse(`"${m[1]}"`); } catch { return ""; } }).filter((v): v is string => typeof v === "string" && v.length > 500);
  if (bodies.length) return bodies.sort((a, b) => b.length - a.length)[0];
  const article = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i); if (article) { const text = cleanHtml(article[1]); if (text.length > 500) return text; }
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i); if (main) { const text = cleanHtml(main[1]); if (text.length > 500) return text; }
  return cleanHtml(html);
}

async function fetchArticle(url?: string) {
  if (!url || !/^https?:\/\//i.test(url)) return "";
  try { const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PostCraftAI/1.0)", Accept: "text/html,application/xhtml+xml" }, cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "follow" }); if (!response.ok) return ""; return extractArticleBody(await response.text()).slice(0, 18_000); }
  catch (error) { console.warn("[PostCraft] article_fetch_failed", error instanceof Error ? error.message : "unknown error"); return ""; }
}

async function buildEvidence(story: Story, articleText: string): Promise<Evidence[]> {
  const source = articleText ? `FULL ARTICLE TEXT:\n${articleText}` : `HEADLINE:\n${story.headline}\nSUMMARY:\n${story.summary}`;
  const prompt = `You are PostCraft AI's evidence extraction engine. Build a compact evidence ledger before generating any opinion.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

${source}

Extract 6-8 high-value evidence items. Prefer numbers, comparisons, mechanisms, scenario assumptions, decisions and specific details.
Rules: use ONLY the supplied material; preserve attribution and uncertainty; a scenario/model is not a forecast; never turn an interpretation into a fact; never add outside knowledge.

Return ONLY JSON: {"evidence":[{"claim":"...","support":"...","type":"fact"}]}`;
  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.05, numPredict: 750 }));
  if (!Array.isArray(parsed?.evidence)) return [];
  return parsed.evidence.map((item): Evidence | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { claim?: unknown; support?: unknown; type?: unknown };
    const claim = typeof v.claim === "string" ? v.claim.trim() : ""; const support = typeof v.support === "string" ? v.support.trim() : "";
    const type = v.type === "fact" || v.type === "interpretation" || v.type === "uncertainty" ? v.type : "fact";
    return claim && support ? { claim, support, type } : null;
  }).filter((x): x is Evidence => Boolean(x)).slice(0, 8);
}

async function generateAngles(story: Story, evidence: Evidence[]) {
  const ledger = evidence.map((e, i) => `${i}. ${e.type.toUpperCase()}\nClaim: ${e.claim}\nSupport: ${e.support}`).join("\n\n");
  const prompt = `You are PostCraft AI's editorial ideation engine. The product promise is: "Find something worth saying."

The angle is the product. Do NOT summarize the article and do NOT produce a generic opinion about AI.

STORY
${story.headline}
${story.source}

EVIDENCE LEDGER
${ledger}

Generate exactly THREE genuinely different angles, strongest first. Each must contain one precise thesis, one concrete evidence anchor, and one non-obvious interpretation of why the anchor matters.

LOOK FOR: an aggregate result hiding a subgroup result; two measures moving in opposite directions; a surprising scenario comparison; a distinction between average outcomes and outcomes for the people most affected; or a mechanism explicitly supported by the source.

For an economic scenario story, strong reasoning can include GDP growth versus labor share, average wages versus knowledge-worker wages, or growth versus occupational switching/unemployment — but only when the ledger supports it.

HARD REJECTIONS
- No vague conclusions such as "AI may increase inequality" or "AI could exacerbate disparities".
- No "raises questions about", "highlights the need", "not evenly distributed", "future of work", "AI transformation", or "responsible innovation" as the insight.
- No invented causal mechanism, motive, winner, loser, policy consequence or prediction.
- Never use "winner-takes-all" unless the source explicitly establishes it.
- Do not confuse scenarios. Modest, substantial and extreme have different numbers and labor outcomes.
- Do not merely put two facts together. Explain the relationship between them.
- If the source gives a scenario/model, call it a scenario/model rather than a forecast.
- Do not add outside knowledge.

The evidence field must identify the ledger item number and concrete detail used.

Return ONLY JSON: {"angles":[{"angle":"one-sentence thesis","why":"specific non-obvious interpretation","evidence":"item 0 — concrete detail"}]}`;
  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.3, numPredict: 1000 }));
  if (!Array.isArray(parsed?.angles)) return [];
  return parsed.angles.map((item): Angle | null => {
    if (!item || typeof item !== "object") return null; const v = item as { angle?: unknown; why?: unknown; evidence?: unknown };
    const angle = typeof v.angle === "string" ? v.angle.trim() : ""; const why = typeof v.why === "string" ? v.why.trim() : ""; const evidenceAnchor = typeof v.evidence === "string" ? v.evidence.trim() : "";
    return angle && why && evidenceAnchor ? { angle, why, evidence: evidenceAnchor } : null;
  }).filter((x): x is Angle => Boolean(x)).slice(0, 3);
}

function passesAngleHeuristics(angle: Angle) {
  const text = `${angle.angle} ${angle.why}`.toLowerCase();
  const forbidden = ["raises questions", "highlights the need", "could exacerbate", "may exacerbate", "not evenly distributed", "winner-takes-all"];
  if (forbidden.some((phrase) => text.includes(phrase))) return false;
  if ((text.includes("modest") && /(job loss|job losses|unemployment|displacement)/.test(text)) || (text.includes("substantial") && text.includes("32.4%")) || (text.includes("extreme") && text.includes("8.3%"))) return false;
  const concrete = /\b\d+(?:\.\d+)?%|\$\d|\d+(?:\.\d+)?\s*(?:trillion|billion|million|x)\b|scenario|model|share|wage|jobs?|unemployment|revenue|cost|time|decision|mechanism|adopt/i;
  return concrete.test(text) && angle.evidence.length > 8;
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now(); const articleText = await fetchArticle(story.url); const evidence = await buildEvidence(story, articleText);
  if (evidence.length < 3) throw new Error("PostCraft could not extract enough reliable evidence from this story. Try opening the source or choose another story.");
  const angles = (await generateAngles(story, evidence)).filter(passesAngleHeuristics);
  if (!angles.length) throw new Error("PostCraft found evidence, but none of the generated angles met its editorial standard. Try another story.");
  console.info(`[PostCraft] editorial_ms=${Date.now() - startedAt} article=${articleText.length > 0} evidence=${evidence.length} angles=${angles.length}`);
  return { angles, evidence };
}

function validateEvidence(value: unknown): Evidence[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): Evidence | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { claim?: unknown; support?: unknown; type?: unknown };
    if (typeof v.claim !== "string" || typeof v.support !== "string") return null;
    if (v.type !== "fact" && v.type !== "interpretation" && v.type !== "uncertainty") return null;
    return { claim: v.claim.trim(), support: v.support.trim(), type: v.type };
  }).filter((x): x is Evidence => Boolean(x?.claim && x.support)).slice(0, 8);
}

function postHasConcreteAnchor(post: string) { return /\b\d+(?:\.\d+)?%|\$\d|\d+(?:\.\d+)?\s*(?:trillion|billion|million|x)\b|scenario|model|share|wage|unemployment/i.test(post); }
function postHasGenericFiller(post: string) { return ["it's crucial to recognize", "not evenly distributed", "highlights the need", "raises a crucial question", "strike a balance", "in today's rapidly changing world", "the future of work"].some((phrase) => post.toLowerCase().includes(phrase)); }

export async function generateEditorialPost(story: Story, angle: string, angleWhy: string, modeInstruction: string, suppliedEvidence?: Evidence[]) {
  let evidence = validateEvidence(suppliedEvidence); if (evidence.length < 3) evidence = await buildEvidence(story, await fetchArticle(story.url));
  if (evidence.length < 3) throw new Error("PostCraft could not recover enough evidence to safely write this post. Try the source again.");
  const ledger = evidence.map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`).join("\n");
  const prompt = `You are PostCraft AI's final LinkedIn editor.

Write a post around ONE precise thesis. The evidence ledger is the complete factual source.

STORY
${story.headline}
${story.source}

SELECTED THESIS
${angle}

WHY THIS ANGLE WORKS
${angleWhy}

EVIDENCE LEDGER
${ledger}

WRITING METHOD
Evidence -> observation -> interpretation -> implication.

NON-NEGOTIABLES
- Start with the actual insight, not the headline and not "AI is changing...".
- Use at least TWO concrete details from the ledger when available. Prefer a number plus a comparison or second number.
- Make the relationship explicit. Do not merely say outcomes are "uneven"; state exactly what changes and for whom.
- If using a scenario/model, name it as a scenario/model. Never turn it into a forecast or current fact.
- Do not introduce facts, examples, quotes, experiences or context outside the ledger.
- Do not strengthen could/may/might into certainty.
- Do not use empty phrases such as "it's crucial to recognize", "not evenly distributed", "highlights the need", "raises a crucial question", "strike a balance", or "the future of work".
- Do not end with a generic call for policymakers, leaders or society.
- Plain language. No corporate jargon. No rhetorical question as a substitute for an argument.
- 110-160 words, 4-6 short paragraphs.

${modeInstruction}

Return ONLY JSON: {"post":"the finished LinkedIn post"}`;
  const result = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.35, numPredict: 520 }));
  const post = typeof result?.post === "string" ? result.post.trim() : "";
  if (!post) throw new Error("PostCraft could not produce a post from the selected angle.");
  if (!postHasConcreteAnchor(post) || postHasGenericFiller(post)) throw new Error("PostCraft generated a draft that was too generic. Try another angle or regenerate.");
  return post;
}
