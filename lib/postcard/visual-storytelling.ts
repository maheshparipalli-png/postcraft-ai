import { VISUAL_STYLES, type VisualStyle } from "./visual-styles";

export type VisualStorytellingInput = { headline: string; body: string; closing: string; };
export type VisualStorytellingPlan = {
  preferredModel?: string; coreTheme: string; emotionalMessage: string; visualConcept: string;
  imagePrompt: string; motivationalSentence: string; textPlacement: "bottom-left";
  visualStyle: VisualStyle; colorDirection: string; negativeSpaceLocation: "lower-left"; aspectRatio: "4:5";
};

export function buildVisualImagePrompt(
  plan: Pick<VisualStorytellingPlan, "coreTheme" | "emotionalMessage" | "visualConcept">,
  visualStyle: VisualStyle,
  colorDirection: string,
) {
  const style = VISUAL_STYLES[visualStyle];
  return [
    style.prompt, plan.visualConcept, `Core idea: ${plan.coreTheme}.`, `Emotional idea: ${plan.emotionalMessage}`,
    "Create one deliberately composed cinematic visual moment, like a frame from a thoughtfully directed film.",
    "Use clear foreground, midground, and background separation, intentional camera perspective, atmospheric depth, directional lighting, dimensional shadows, subtle dramatic contrast, and a strong visual focal point.",
    "Communicate the idea entirely through visual storytelling. The generated artwork must contain no text.",
    "ABSOLUTELY NO WORDS, LETTERS, NUMBERS, CAPTIONS, TYPOGRAPHY, SIGNS, POSTERS, BOOK PAGES, LABELS, LOGOS, WATERMARKS, SPEECH BUBBLES, UI ELEMENTS, OR WRITTEN LANGUAGE OF ANY KIND.",
    "Do not place writing on clothing, buildings, screens, papers, roads, walls, signs, objects, or in the background.",
    "Single dominant subject, strong visual hierarchy, meaningful movement or direction, subtle symbolism, and a memorable moment.",
    colorDirection,
    "Leave clean, visually simple negative space in the lower-left area for a short motivational sentence to be added later by PostCraft.",
    "No stock-photo look, no generic corporate imagery, no clutter, no decorative text, and no collage.",
    "Vertical 4:5 composition, sophisticated, cinematic, memorable.",
  ].join(" ");
}

export function createVisualStorytellingPlan(
  ai: { coreTheme: string; emotionalMessage: string; visualConcept: string; motivationalSentence: string; colorDirection?: string },
  visualStyle: VisualStyle = "editorial",
): VisualStorytellingPlan {
  const colorDirection = ai.colorDirection?.trim() || "Natural warm daylight with restrained neutral tones and subtle contrast.";
  const base = {
    coreTheme: ai.coreTheme.trim(), emotionalMessage: ai.emotionalMessage.trim(), visualConcept: ai.visualConcept.trim(),
    motivationalSentence: ai.motivationalSentence.trim(), textPlacement: "bottom-left" as const,
    visualStyle, colorDirection, negativeSpaceLocation: "lower-left" as const, aspectRatio: "4:5" as const,
  };
  return { ...base, preferredModel: VISUAL_STYLES[visualStyle].preferredModel, imagePrompt: buildVisualImagePrompt(base, visualStyle, colorDirection) };
}
