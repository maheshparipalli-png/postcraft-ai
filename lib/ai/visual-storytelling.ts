import { getAIProvider } from "@/lib/ai/provider";
import { createVisualStorytellingPlan, type VisualStorytellingInput, type VisualStorytellingPlan } from "@/lib/postcard/visual-storytelling";
import type { VisualStyle } from "@/lib/postcard/visual-styles";

function parseJson(text: string): Record<string, unknown> | null {
  try { const value=JSON.parse(text); return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : null; }
  catch { const match=text.match(/\{[\s\S]*\}/); if(!match)return null; try { const value=JSON.parse(match[0]); return value && typeof value==="object" && !Array.isArray(value) ? value as Record<string,unknown> : null; } catch { return null; } }
}
function field(value: unknown, name: string) { if(typeof value!=="string" || !value.trim()) throw new Error(`Visual storytelling AI returned no ${name}.`); return value.trim(); }

export async function generateVisualStorytellingPlan(input: VisualStorytellingInput, visualStyle: VisualStyle): Promise<VisualStorytellingPlan> {
  const provider=await getAIProvider();
  const prompt=`You are PostCraft's Visual Storytelling Director.

Understand the user's meaning. Do NOT classify the idea with keywords and do NOT summarize it.

USER INPUT
Headline: ${input.headline}
Body: ${input.body}
Closing: ${input.closing || "(none)"}

VISUAL STYLE: ${visualStyle}

Identify ONE core idea, ONE human insight, ONE central tension or contrast when it naturally exists, ONE original visual metaphor, and ONE motivational sentence specific to this input.
The visual metaphor must be a concrete scene, not an abstract concept. Prefer a central subject, meaningful movement or direction, contrast, symbolism, depth, and a memorable moment.
Do not introduce facts, themes, lessons, or advice not supported by the user's input. Do not reuse stock metaphors merely because a keyword appears. Meaning determines metaphor.
The motivational sentence must be 5-12 words, simple English, specific to the user's meaning.
Return ONLY valid JSON:
{"coreTheme":"one clear sentence","emotionalMessage":"one clear sentence","visualConcept":"one detailed visual metaphor/scene","motivationalSentence":"5-12 words, simple English, specific to the idea","colorDirection":"one concise visual direction"}

Before returning, check: the image would communicate the idea without text; the metaphor expresses this exact idea rather than a generic life lesson; the sentence comes from the user's meaning; there is one dominant visual idea; the scene suits a premium editorial composition.`;
  const raw=await provider.generateText(prompt,{format:"json",temperature:0.35,numPredict:700});
  const parsed=parseJson(raw); if(!parsed) throw new Error("Visual storytelling AI returned invalid JSON.");
  return createVisualStorytellingPlan({
    coreTheme:field(parsed.coreTheme,"core idea"),
    emotionalMessage:field(parsed.emotionalMessage,"human insight"),
    visualConcept:field(parsed.visualConcept,"visual metaphor"),
    motivationalSentence:field(parsed.motivationalSentence,"motivational sentence"),
    colorDirection:typeof parsed.colorDirection==="string"?parsed.colorDirection:undefined,
  },visualStyle);
}
