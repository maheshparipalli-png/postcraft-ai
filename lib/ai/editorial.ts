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
  try { const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PostCraftAI/1.0)", Accept: "text/html,application/xhtml+xml" }, cache: "no-store", signal: AbortSignal.timeout(7_000), redirect: "follow" }); if (!response.ok) return ""; return extractArticleBody(await response.text()).slice(0, 4_500); }
  catch (error) { console.warn("[PostCraft] article_fetch_failed", error instanceof Error ? error.message : "unknown error"); return ""; }
}

function parseEvidence(value: unknown): Evidence[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): Evidence | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { claim?: unknown; support?: unknown; type?: unknown };
    const claim = typeof v.claim === "string" ? v.claim.trim() : "";
    const support = typeof v.support === "string" ? v.support.trim() : "";
    const type = v.type === "fact" || v.type === "interpretation" || v.type === "uncertainty" ? v.type : "fact";
    return claim && support ? { claim, support, type } : null;
  }).filter((x): x is Evidence => Boolean(x)).slice(0, 5);
}

function fallbackEvidence(story: Story, articleText: string): Evidence[] {
  const evidence: Evidence[] = [];
  if (story.headline.trim()) evidence.push({ claim: story.headline.trim(), support: "Publisher headline.", type: "fact" });
  if (story.summary.trim()) evidence.push({ claim: story.summary.trim(), support: "Publisher-provided story summary.", type: "fact" });
  if (articleText.trim()) evidence.push({ claim: "The source article was retrieved successfully.", support: `Retrieved source text (${articleText.length} characters).`, type: "fact" });
  return evidence.slice(0, 5);
}

function parseAngles(value: unknown): Angle[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): Angle | null => {
    if (!item || typeof item !== "object") return null;
    const v = item as { angle?: unknown; why?: unknown; evidence?: unknown };
    const angle = typeof v.angle === "string" ? v.angle.trim() : "";
    const why = typeof v.why === "string" ? v.why.trim() : "";
    const evidence = typeof v.evidence === "string" ? v.evidence.trim() : "";
    return angle && why && evidence ? { angle, why, evidence } : null;
  }).filter((x): x is Angle => Boolean(x)).slice(0, 3);
}

async function buildEditorialPass(story: Story, articleText: string) {
  const source = articleText ? `ARTICLE:\n${articleText}` : `HEADLINE:\n${story.headline}\nSUMMARY:\n${story.summary}`;
  const prompt = `You are PostCraft AI, an editorial thinking partner. Your job is not to summarize the story. First extract the most important concrete facts. Then identify the strongest relationships, contrasts, or tensions between those facts. Finally select exactly 3 editorial angles.\n\n${source}\n\nRules: each angle must make one precise claim, be directly supported by the source, and use a materially different relationship or contrast. Do not create three variations of the same idea. Prefer numbers, comparisons, mechanisms, affected groups, or differences between scenarios. Do not add outside facts. Do not turn scenarios into forecasts. Avoid generic ideas such as "AI may increase inequality", "technology is changing work", "raises questions", "future of work", or "responsible innovation". If two candidate angles use essentially the same relationship, keep the stronger one and replace it with a genuinely different relationship.\n\nA strong angle can look like: "An economy can become dramatically richer while workers receive a smaller share of the wealth it creates."\n\nReturn ONLY compact JSON with exactly this shape: {"evidence":[{"claim":"short factual claim","support":"short source support","type":"fact"}],"angles":[{"angle":"precise thesis","why":"why this relationship matters","evidence":"concrete source anchor"},{"angle":"different precise thesis","why":"why this relationship matters","evidence":"concrete source anchor"},{"angle":"different precise thesis","why":"why this relationship matters","evidence":"concrete source anchor"}]}`;
  const parsed = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.1, numPredict: 900 }));
  return { evidence: parseEvidence(parsed?.evidence), angles: parseAngles(parsed?.angles) };
}

function isForbiddenAngle(angle: Angle) {
  const text = `${angle.angle} ${angle.why}`.toLowerCase();
  const forbidden = ["raises questions", "highlights the need", "could exacerbate", "may exacerbate", "not evenly distributed", "winner-takes-all", "future of work", "responsible innovation"];
  if (forbidden.some((phrase) => text.includes(phrase))) return true;
  if ((text.includes("modest") && /(job loss|job losses|unemployment|displacement)/.test(text)) || (text.includes("substantial") && text.includes("32.4%")) || (text.includes("extreme") && text.includes("8.3%"))) return true;
  return false;
}

function selectSafeAngles(angles: Angle[]) {
  return angles.filter((angle) => !isForbiddenAngle(angle)).slice(0, 3);
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now();
  const articleText = await fetchArticle(story.url);
  const editorial = await buildEditorialPass(story, articleText);
  const evidence = editorial.evidence.length >= 3 ? editorial.evidence : fallbackEvidence(story, articleText);
  const angles = selectSafeAngles(editorial.angles);
  console.info(`[PostCraft] editorial_ms=${Date.now() - startedAt} article=${articleText.length > 0} evidence=${evidence.length} generated_angles=${editorial.angles.length} accepted_angles=${angles.length} fallback=${editorial.evidence.length < 3}`);
  if (evidence.length < 2) throw new Error("PostCraft could not extract enough reliable evidence from this story. Try opening the source or choose another story.");
  if (angles.length < 3) throw new Error("PostCraft found evidence, but the model did not return three usable angles. Try another story.");
  return { angles, evidence };
}

function validateEvidence(value: unknown): Evidence[] { return parseEvidence(value); }
function postHasConcreteAnchor(post: string) { return /\b\d+(?:\.\d+)?%|\$\d|\d+(?:\.\d+)?\s*(?:trillion|billion|million|x)\b|scenario|model|share|wage|unemployment/i.test(post); }
function postHasGenericFiller(post: string) { return ["it's crucial to recognize", "not evenly distributed", "highlights the need", "raises a crucial question", "strike a balance", "in today's rapidly changing world", "the future of work"].some((phrase) => post.toLowerCase().includes(phrase)); }

export async function generateEditorialPost(story: Story, angle: string, angleWhy: string, modeInstruction: string, suppliedEvidence?: Evidence[]) {
  let evidence = validateEvidence(suppliedEvidence);
  if (evidence.length < 2) evidence = (await buildEditorialPass(story, await fetchArticle(story.url))).evidence;
  if (evidence.length < 2) evidence = fallbackEvidence(story, "");
  if (evidence.length < 2) throw new Error("PostCraft could not recover enough evidence to safely write this post. Try the source again.");
  const ledger = evidence.map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`).join("\n");
  const prompt = `You are PostCraft AI's final LinkedIn editor. Write a post around ONE precise thesis using only this evidence ledger. Start with the insight. Use at least two concrete details when available. Make the relationship explicit. If using a scenario/model, name it as such. Do not add outside facts, examples or context. Do not turn could/may/might into certainty. Plain language, no corporate jargon, 110-160 words, 4-6 short paragraphs.\n\nSTORY\n${story.headline}\n${story.source}\n\nSELECTED THESIS\n${angle}\n\nWHY THIS ANGLE WORKS\n${angleWhy}\n\nEVIDENCE LEDGER\n${ledger}\n\n${modeInstruction}\n\nReturn ONLY JSON: {"post":"the finished LinkedIn post"}`;
  const result = parseJson(await provider().generateText(prompt, { format: "json", temperature: 0.3, numPredict: 320 }));
  const post = typeof result?.post === "string" ? result.post.trim() : "";
  if (!post) throw new Error("PostCraft could not produce a post from the selected angle.");
  if (!postHasConcreteAnchor(post) || postHasGenericFiller(post)) throw new Error("PostCraft generated a draft that was too generic. Try another angle or regenerate.");
  return post;
}
