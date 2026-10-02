import { getAIProvider } from "@/lib/ai/provider";
import { createVisualStorytellingPlan, type VisualStorytellingInput, type VisualStorytellingPlan } from "@/lib/postcard/visual-storytelling";
import type { VisualStyle } from "@/lib/postcard/visual-styles";

/** Parse a JSON object even when a provider wraps it in Markdown or adds brief prose. */
function parseJson(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^\x60{3}(?:json)?\s*/i, "").replace(/\s*\x60{3}$/i, "").trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf("{");
  if (start >= 0 && cleaned !== cleaned.slice(start)) candidates.push(cleaned.slice(start));

  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      // Try extracting the first complete JSON object below.
    }
  }

  // Extract the first balanced object, respecting braces inside quoted strings.
  const objectStart = cleaned.indexOf("{");
  if (objectStart < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = objectStart; i < cleaned.length; i += 1) {
    const char = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        try {
          const value: unknown = JSON.parse(cleaned.slice(objectStart, i + 1));
          return value && typeof value === "object" && !Array.isArray(value)
            ? value as Record<string, unknown>
            : null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

function field(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Visual storytelling AI returned no ${name}. Please try again.`);
  }
  return value.trim();
}

export async function generateVisualStorytellingPlan(
  input: VisualStorytellingInput,
  visualStyle: VisualStyle,
  conceptIndex = 0,
): Promise<VisualStorytellingPlan> {
  const provider = await getAIProvider();
  const prompt = `You are PostCraft's Visual Storytelling Director.

Understand the user's meaning. Do NOT classify the idea with keywords and do NOT summarize it.

USER INPUT
Headline: ${input.headline}
Body: ${input.body}
Closing: ${input.closing || "(none)"}

VISUAL STYLE: ${visualStyle}

CONCEPT VARIATION: ${conceptIndex + 1} of 4. Create a genuinely different visual metaphor from the other variations: variation 1 favors a human-scale intimate moment; variation 2 favors a striking environmental or architectural metaphor; variation 3 favors a meaningful object or symbolic transformation; variation 4 favors an unexpected perspective or visual contrast. Do not mention these labels in the result. Avoid common stock metaphors.

Identify ONE core idea, ONE human insight, ONE central tension or contrast when it naturally exists, ONE original visual metaphor, and ONE motivational sentence specific to this input.
The visual metaphor must be a concrete scene, not an abstract concept. Prefer a central subject, meaningful movement or direction, contrast, symbolism, depth, and a memorable moment.
Do not introduce facts, themes, lessons, or advice not supported by the user's input. Do not reuse stock metaphors merely because a keyword appears. Meaning determines metaphor.
The motivational sentence must be 5-12 words, simple English, specific to the user's meaning.
Return ONLY one valid JSON object, with no Markdown fences or text before or after it. Use exactly these string fields:
{"coreTheme":"one clear sentence","emotionalMessage":"one clear sentence","visualConcept":"one detailed visual metaphor/scene","motivationalSentence":"5-12 words, simple English, specific to the idea","colorDirection":"one concise visual direction"}

Before returning, check: the image would communicate the idea without text; the metaphor expresses this exact idea rather than a generic life lesson; the sentence comes from the user's meaning; there is one dominant visual idea; the scene suits a premium editorial composition.`;
  const raw = await provider.generateText(prompt, { format: "json", temperature: 0.2, numPredict: 900 });
  const parsed = parseJson(raw);
  if (!parsed) {
    console.error("[PostCraft] Visual storytelling provider returned non-JSON output", {
      outputLength: raw.length,
      startsWithFence: /^\s*```/.test(raw),
    });
    throw new Error("The AI provider returned an unreadable visual plan. Please try again.");
  }
  return createVisualStorytellingPlan({
    coreTheme: field(parsed.coreTheme, "core idea"),
    emotionalMessage: field(parsed.emotionalMessage, "human insight"),
    visualConcept: field(parsed.visualConcept, "visual metaphor"),
    motivationalSentence: field(parsed.motivationalSentence, "motivational sentence"),
    colorDirection: field(parsed.colorDirection, "color direction"),
  }, visualStyle);
}
