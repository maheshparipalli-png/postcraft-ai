export type VisualStorytellingInput = {
  headline: string;
  body: string;
  closing: string;
};

export type VisualStorytellingPlan = {
  coreTheme: string;
  emotionalMessage: string;
  visualConcept: string;
  imagePrompt: string;
  motivationalSentence: string;
  textPlacement: "bottom-left";
  visualStyle: string;
  colorDirection: string;
  negativeSpaceLocation: string;
  aspectRatio: "4:5";
};

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function words(value: string) {
  return clean(value).split(/\s+/).filter(Boolean);
}

function sentenceFromClosing(closing: string) {
  const source = clean(closing).replace(/^["'“”]+|["'“”]+$/g, "");
  if (!source) return "Choose the path that matters.";
  const list = words(source).slice(0, 12);
  return list.join(" ").replace(/[.!?]+$/, "") + ".";
}

export function buildVisualStorytellingPlan(input: VisualStorytellingInput): VisualStorytellingPlan {
  const headline = clean(input.headline);
  const body = clean(input.body);
  const closing = clean(input.closing);
  const source = [headline, body, closing].filter(Boolean).join(" ");
  const coreTheme = headline || body || closing || "A meaningful idea";
  const lower = source.toLowerCase();

  let emotionalMessage = "The courage to act on what matters.";
  let visualConcept = "A lone person choosing a clear path while the world around them moves in another direction.";
  let colorDirection = "Natural warm daylight with restrained neutral tones and subtle contrast.";

  if (/lead|leader|leadership|team|people/.test(lower)) {
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
    "Premium editorial photograph for a LinkedIn thought-leadership post.",
    visualConcept,
    `Core idea: ${coreTheme}.`,
    `Emotional idea: ${emotionalMessage}`,
    "Communicate the idea visually without any words or typography inside the image.",
    "Single dominant subject, strong visual hierarchy, meaningful movement or direction, subtle symbolism, cinematic composition.",
    "Photorealistic, natural textures, realistic human proportions, atmospheric depth, natural lighting, controlled depth of field.",
    colorDirection,
    "Leave clean negative space in the lower-left area for a short motivational sentence.",
    "No text, no letters, no logos, no watermark, no stock-photo look, no cartoon style, no excessive technology, no clutter.",
    "Vertical 4:5 editorial composition, sophisticated and memorable.",
  ].join(" ");

  return {
    coreTheme,
    emotionalMessage,
    visualConcept,
    imagePrompt,
    motivationalSentence: sentenceFromClosing(closing),
    textPlacement: "bottom-left",
    visualStyle: "Premium cinematic editorial photography, photorealistic, natural textures, atmospheric depth.",
    colorDirection,
    negativeSpaceLocation: "lower-left",
    aspectRatio: "4:5",
  };
}
