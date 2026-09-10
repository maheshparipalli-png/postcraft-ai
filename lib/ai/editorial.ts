import { getAIProvider } from "@/lib/ai/provider";

type Story = { topic: string; headline: string; source: string; summary: string; url?: string };
export type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
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
    const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PostCraftAI/1.0)", Accept: "text/html,application/xhtml+xml" }, cache: "no-store", signal: AbortSignal.timeout(10_000), redirect: "follow" });
    if (!response.ok) return "";
    return extractArticleBody(await response.text()).slice(0, 18_000);
  } catch (error) {
    console.warn("[PostCraft] article_fetch_failed", error instanceof Error ? error.message : "unknown error");
    return "";
  }
}

async function buildEvidence(story: Story, articleText: string): Promise<Evidence[]> {
  const source = articleText ? `FULL ARTICLE TEXT:\n${articleText}` : `HEADLINE:\n${story.headline}\nSUMMARY:\n${story.summary}`;
  const prompt = `You are PostCraft AI's evidence extraction engine. Build a compact evidence ledger before generating any opinion.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}

${source}

Extract 5-8 useful evidence items. Prefer numbers, comparisons, mechanisms, scenarios, decisions and specific details.
Rules:
- Use ONLY the supplied material.
- Preserve attribution and uncertainty.
- Never turn an interpretation into a fact.
- Never add outside knowledge.

Return ONLY JSON: {"evidence":[{"claim":"...","support":"...","type":"fact"}]}`;
  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.1, numPredict: 650 }));
  if (!Array.isArray(parsed?.evidence)) return [];
  return parsed.evidence.map((item): Evidence | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { claim?: unknown; support?: unknown; type?: unknown };
    const claim = typeof v.claim === "string" ? v.claim.trim() : "";
    const support = typeof v.support === "string" ? v.support.trim() : "";
    const type = v.type === "fact" || v.type === "interpretation" || v.type === "uncertainty" ? v.type : "fact";
    return claim && support ? { claim, support, type } : null;
  }).filter((x): x is Evidence => x !== null).slice(0, 8);
}

async function generateAngles(story: Story, evidence: Evidence[]) {
  const ledger = evidence.map((e, i) => `${i}. ${e.type.toUpperCase()}\nClaim: ${e.claim}\nSupport: ${e.support}`).join("\n\n");
  const prompt = `You are PostCraft AI's editorial ideation engine. The product promise is: "Find something worth saying."

Find the strongest specific arguments hidden inside this exact story. The angle is the product; writing comes later.

STORY
${story.headline}
${story.source}

EVIDENCE LEDGER
${ledger}

Generate THREE genuinely different angles and rank them from strongest to weakest. Each must contain:
1. ONE thesis someone could agree or disagree with.
2. ONE concrete evidence anchor from the ledger.
3. ONE interpretation explaining why that anchor matters.

QUALITY BAR
- Prefer a surprising relationship between concrete facts over a broad topic label.
- Prefer a precise statement such as "The striking part is not X; it is Y, as shown by Z."
- Prefer a comparison, contradiction, mechanism, trade-off or assumption challenged by the evidence.
- A good angle should make the reader see the story differently, not merely understand it.
- Narrow and specific beats dramatic and vague.
- If the source gives a scenario, explicitly call it a scenario/model; never present it as a forecast.

HARD REJECTIONS
- No generic claims about inequality, disruption, transformation, leadership, innovation, the future of work, or responsible AI unless the exact evidence-based relationship is stated.
- Do not use "raises questions", "highlights the need", "could exacerbate", "may create disparities", or similar language as the insight. State the actual relationship.
- Do not use "while X, Y" as the whole argument. Explain what the relationship means.
- Do not invent causes, motives, winners, losers, policy outcomes or consequences.
- Do not use a causal mechanism unless the supplied evidence supports it.
- Do not use "winner-takes-all" unless the source explicitly says that.
- Do not add outside facts.

For each angle, evidence must identify the ledger item number and concrete detail used.

Return ONLY JSON: {"angles":[{"angle":"one-sentence thesis","why":"specific interpretation","evidence":"item 0 — concrete detail"}]}`;
  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.35, numPredict: 850 }));
  if (!Array.isArray(parsed?.angles)) return [];
  return parsed.angles.map((item): Angle | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { angle?: unknown; why?: unknown; evidence?: unknown };
    const angle = typeof v.angle === "string" ? v.angle.trim() : "";
    const why = typeof v.why === "string" ? v.why.trim() : "";
    const evidenceAnchor = typeof v.evidence === "string" ? v.evidence.trim() : "";
    return angle && why && evidenceAnchor ? { angle, why, evidence: evidenceAnchor } : null;
  }).filter((x): x is Angle => x !== null).slice(0, 3);
}

function passesAngleHeuristics(angle: Angle) {
  const text = `${angle.angle} ${angle.why}`.toLowerCase();
  const forbidden = ["raises questions", "highlights the need", "could exacerbate", "may exacerbate", "not evenly distributed", "winner-takes-all"];
  if (forbidden.some((phrase) => text.includes(phrase))) return false;
  const concrete = /\b\d+(?:\.\d+)?%|\$\d|\d+(?:\.\d+)?\s*(?:trillion|billion|million|x)\b|scenario|model|share|wage|jobs?|unemployment|revenue|cost|time|decision|mechanism|adopt/i;
  return concrete.test(text) && angle.evidence.length > 8;
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now();
  const articleText = await fetchArticle(story.url);
  const evidence = await buildEvidence(story, articleText);
  if (evidence.length < 3) throw new Error("PostCraft could not extract enough reliable evidence from this story. Try opening the source or choose another story.");
  const angles = (await generateAngles(story, evidence)).filter(passesAngleHeuristics);
  if (!angles.length) throw new Error("PostCraft found evidence, but none of the generated angles met its editorial standard. Try another story.");
  console.info(`[PostCraft] editorial_ms=${Date.now() - startedAt} article=${articleText.length > 0} evidence=${evidence.length} angles=${angles.length}`);
  return { angles, evidence };
}

function postHasConcreteAnchor(post: string) {
  return /\b\d+(?:\.\d+)?%|\$\d|\d+(?:\.\d+)?\s*(?:trillion|billion|million|x)\b|scenario|model|share|wage|jobs?|unemployment|revenue|cost|time|decision/i.test(post);
}

function postHasGenericFiller(post: string) {
  return ["it's crucial to recognize", "not evenly distributed", "highlights the need", "raises a crucial question", "strike a balance", "in today's rapidly changing world"].some((phrase) => post.toLowerCase().includes(phrase));
}

export async function generateEditorialPost(story: Story, angle: string, angleWhy: string, modeInstruction: string, suppliedEvidence?: Evidence[]) {
  const evidence = suppliedEvidence?.length ? suppliedEvidence : await buildEvidence(story, await fetchArticle(story.url));
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

METHOD
Evidence -> observation -> interpretation -> implication.

NON-NEGOTIABLES
- Include at least one concrete anchor from the ledger, preferably a number, comparison, mechanism or scenario.
- If using a scenario/model, say it is a scenario/model; never present it as a forecast or fact.
- Do not introduce facts, examples, quotes, experiences or context outside the ledger.
- Do not strengthen could/may/might into certainty.
- Do not use empty phrases such as "it's crucial to recognize", "not evenly distributed", "highlights the need", "raises a crucial question", or "strike a balance".
- Do not end with a generic call for policymakers, leaders or society.
- Start with the actual insight, not the headline.
- Plain language. No corporate jargon. No rhetorical question as a substitute for a point.
- 120-180 words, 4-7 short paragraphs.

${modeInstruction}

Return ONLY JSON: {"post":"..."}`;

  const result = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.45, numPredict: 520 }));
  const post = typeof result?.post === "string" ? result.post.trim() : "";
  if (!post) throw new Error("PostCraft could not produce a post from the selected angle.");
  if (!postHasConcreteAnchor(post) || postHasGenericFiller(post)) throw new Error("PostCraft generated a draft that was too generic. Try another angle or regenerate.");
  return post;
}
