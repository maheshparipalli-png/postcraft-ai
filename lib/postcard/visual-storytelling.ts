export type VisualStorytellingInput = {
  headline: string;
  body: string;
  closing: string;
};

import { VISUAL_STYLES, type VisualStyle } from "./visual-styles";

export type VisualStorytellingPlan = {\n  preferredModel?: string;
  coreTheme: string;
  emotionalMessage: string;
  visualConcept: string;
  imagePrompt: string;
  motivationalSentence: string;
  textPlacement: "bottom-left";
  visualStyle: VisualStyle;
  colorDirection: string;
  negativeSpaceLocation: "lower-left";
  aspectRatio: "4:5";
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function words(value: string) {
  return clean(value).split(/\s+/).filter(Boolean);
}

function sentenceFromClosing(closing: string, sourceText: string) {
  const source = clean(closing).replace(/^[\"'“”]+|[\"'“”]+$/g, "");
  if (source) {
    const list = words(source).slice(0, 12);
    return list.join(" ").replace(/[.!?]+$/, "") + ".";
  }

  const sourceLower = sourceText.toLowerCase();
  if (/not everyone|nobody understand|people.*understand|understand your journey|journey/.test(sourceLower)) {
    return "Keep walking, even when others do not understand.";
  }
  if (/keep going|keep moving|don't give up|do not give up|persist/.test(sourceLower)) {
    return "Keep going when the path gets difficult.";
  }
  if (/work hard|working hard|effort|discipline/.test(sourceLower)) {
    return "Effort matters most when it is directed well.";
  }
  if (/fear|afraid|scared|courage|brave/.test(sourceLower)) {
    return "Courage begins when you move despite fear.";
  }

  return "Choose the path that matters.";
}

function inferCoreTheme(sourceText: string, headline: string) {
  const sourceLower = sourceText.toLowerCase();

  if (/not everyone|nobody understand|people.*understand|understand your journey|journey/.test(sourceLower)) {
    return "Your journey does not need everyone's understanding.";
  }
  if (/keep going|keep moving|don't give up|do not give up|persist/.test(sourceLower)) {
    return "Progress sometimes means continuing when it gets difficult.";
  }
  if (/work hard|working hard/.test(sourceLower)) {
    return "Hard work matters, but direction matters too.";
  }

  const value = clean(headline);
  if (!value) return "A meaningful idea";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

const STYLE_DETAILS: Record<VisualStyle, { label: string; prompt: string }> = {
  editorial: {
    label: "Premium cinematic editorial photography",
    prompt: "Photorealistic premium editorial photograph, natural textures, realistic human proportions, atmospheric depth, natural lighting, controlled depth of field.",
  },
  cartoon: {
    label: "Sophisticated editorial cartoon illustration",
    prompt: "Sophisticated editorial cartoon illustration, expressive but believable human forms, clean confident linework, refined shapes, subtle dimensional shading, restrained premium palette, intelligent visual storytelling, polished magazine illustration quality.",
  },
  "hand-drawn": {
    label: "Hand-drawn editorial illustration",
    prompt: "Hand-drawn editorial illustration, elegant ink and pencil texture, organic line variation, subtle paper grain, refined composition, human warmth, restrained sophisticated palette, polished magazine illustration quality.",
  },
  "3d": {
    label: "Cinematic 3D illustration",
    prompt: "Cinematic 3D illustration, believable stylized forms, refined materials, soft realistic lighting, subtle depth, premium visual design, restrained colors, sophisticated editorial advertising aesthetic.",
  },
  anime: {
    label: "Cinematic anime illustration",
    prompt: "Cinematic anime-inspired editorial illustration, expressive but restrained character design, elegant composition, refined linework, atmospheric depth, sophisticated lighting, mature magazine-art direction rather than childish cartoon styling.",
  },
  watercolor: {
    label: "Editorial watercolor illustration",
    prompt: "Editorial watercolor illustration, expressive brushwork, delicate paper texture, controlled washes, subtle ink accents, atmospheric depth, sophisticated muted palette, premium magazine illustration aesthetic.",
  },
};

export function buildVisualStorytellingPlan(
  input: VisualStorytellingInput,
  visualStyle: VisualStyle = "editorial",
): VisualStorytellingPlan {
  const headline = clean(input.headline);
  const body = clean(input.body);
  const closing = clean(input.closing);
  const source = [headline, body, closing].filter(Boolean).join(" ");
  const coreTheme = inferCoreTheme(source, headline || body || closing);
  const lower = source.toLowerCase();
  const style = VISUAL_STYLES[visualStyle];

  let emotionalMessage = "The courage to act on what matters.";
  let visualConcept = "A lone person choosing a clear path while the world around them moves in another direction.";
  let colorDirection = "Natural warm daylight with restrained neutral tones and subtle contrast.";

  if (/not everyone|nobody understand|people.*understand|understand your journey|journey/.test(lower)) {
    emotionalMessage = "You do not need everyone's approval to keep moving toward what matters.";
    visualConcept = "One person walking calmly along a quiet road while other people take a different route in the distance, creating a feeling of conviction without isolation.";
  } else if (/lead|leader|leadership|team|people/.test(lower)) {
    emotionalMessage = "Leadership is creating direction and making space for others.";
    visualConcept = "One person slightly ahead on a wide path, turning back to guide others forward.";
  } else if (/change|adapt|learning|learn|growth/.test(lower)) {
    emotionalMessage = "Growth begins when we stop protecting the familiar.";
    visualConcept = "A person stepping from a familiar shadow into open morning light.";
  } else if (/fail|failure|setback|mistake|comeback|resilien/.test(lower)) {
    emotionalMessage = "A setback can become the moment that changes direction.";
    visualConcept = "A person rising after a difficult climb, looking toward a brighter ridge.";
  } else if (/focus|discipline|consisten|habit|work|effort/.test(lower)) {
    emotionalMessage = "Small deliberate actions create momentum.";
    visualConcept = "A person walking steadily through a long quiet road while distant distractions blur behind.";
  } else if (/risk|courage|fear|choice|decision|different|bold/.test(lower)) {
    emotionalMessage = "Meaningful choices often require leaving the crowded path.";
    visualConcept = "A quiet fork in a road at sunrise, with one person choosing the less-traveled path.";
  } else if (/money|financial|business|entrepreneur|career/.test(lower)) {
    emotionalMessage = "Long-term value is built through deliberate choices.";
    visualConcept = "A person building a simple foundation stone by stone while a busy city moves in the background.";
    colorDirection = "Sophisticated natural daylight, warm stone and muted urban neutrals.";
  }

  const imagePrompt = [
    style.prompt,
    visualConcept,
    `Core idea: ${coreTheme}.`,
    `Emotional idea: ${emotionalMessage}`,
    "Communicate the idea visually without any words or typography inside the image.",
    "Absolutely no readable text, letters, numbers, captions, signs, posters, book pages, labels, logos, watermarks, or typographic marks anywhere in the image.",
    "Single dominant subject, strong visual hierarchy, meaningful movement or direction, subtle symbolism, cinematic composition.",
    colorDirection,
    "Leave clean, visually simple negative space in the lower-left area for a short motivational sentence to be added later by PostCraft.",
    "No signage, no written surfaces, no stock-photo look, no clutter, no generic corporate imagery.",
    "Vertical 4:5 composition, sophisticated and memorable.",
  ].join(" ");

  return {
    coreTheme,
    emotionalMessage,
    visualConcept,
    imagePrompt,
    motivationalSentence: sentenceFromClosing(closing, source),
    textPlacement: "bottom-left",
    visualStyle,
    colorDirection,
    negativeSpaceLocation: "lower-left",
    aspectRatio: "4:5",
  };
}
