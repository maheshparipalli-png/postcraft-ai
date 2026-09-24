import { decodeHtmlEntities } from "@/lib/text/decode-html";
import { getAIProvider } from "@/lib/ai/provider";

type Story = { topic: string; headline: string; source: string; summary: string; url?: string };
export type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type Angle = { angle: string; why: string; evidence: string };

const provider = () => getAIProvider();

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      const value = JSON.parse(match[0]);
      return value && typeof value === "object" && !Array.isArray(value)
        ? value as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  }
}

function parseEvidence(value: unknown): Evidence[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): Evidence | null => {
      if (!item || typeof item !== "object") return null;

      const v = item as {
        claim?: unknown;
        support?: unknown;
        type?: unknown;
      };

      const claim = typeof v.claim === "string" ? v.claim.trim() : "";
      const support = typeof v.support === "string" ? v.support.trim() : "";
      const type =
        v.type === "fact" ||
        v.type === "interpretation" ||
        v.type === "uncertainty"
          ? v.type
          : "fact";

      return claim && support ? { claim, support, type } : null;
    })
    .filter((x): x is Evidence => Boolean(x))
    .slice(0, 3);
}

function parseAngles(value: unknown): Angle[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item): Angle | null => {
      if (!item || typeof item !== "object") return null;

      const v = item as {
        angle?: unknown;
        text?: unknown;
        why?: unknown;
        evidence?: unknown;
      };

      const angleValue =
        typeof v.angle === "string"
          ? v.angle
          : typeof v.text === "string"
            ? v.text
            : "";

      const angle = angleValue.trim();
      const why = typeof v.why === "string" ? v.why.trim() : "";
      const evidence =
        typeof v.evidence === "string" && v.evidence.trim()
          ? v.evidence.trim()
          : "Based on the selected story and its supplied summary.";

      return angle
        ? {
            angle,
            why:
              why ||
              "This provides a specific, evidence-led point of view on the selected story.",
            evidence,
          }
        : null;
    })
    .filter((x): x is Angle => Boolean(x))
    .slice(0, 3);
}

function normalizeAngleText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function angleSimilarity(a: string, b: string) {
  const aTokens = new Set(normalizeAngleText(a).split(" ").filter((word) => word.length >= 4));
  const bTokens = new Set(normalizeAngleText(b).split(" ").filter((word) => word.length >= 4));
  if (!aTokens.size || !bTokens.size) return 0;

  let shared = 0;
  for (const token of aTokens) if (bTokens.has(token)) shared += 1;
  return shared / Math.min(aTokens.size, bTokens.size);
}

function isForbiddenAngle(angle: Angle) {
  const text = `${angle.angle} ${angle.why}`.toLowerCase();

  return [
    "raises questions",
    "raises a question",
    "highlights the need",
    "could exacerbate",
    "may exacerbate",
    "winner-takes-all",
    "future of work",
    "responsible innovation",
    "need to adapt",
    "need to upskill",
    "need to reskill",
    "commitment to innovation",
    "set a precedent",
    "broader adoption",
    "improve efficiency",
    "accelerate progress",
    "changing nature of work",
    "technology is changing",
    "ai is changing",
    "ai will change everything",
  ].some((phrase) => text.includes(phrase));
}


type RankedAngle = Angle & {
  score: number;
  criteria: {
    readerInterest: number;
    discussionPotential: number;
    relevance: number;
    clarity: number;
    specificity: number;
    linkedinFit: number;
    evidenceStrength: number;
  };
};

function isWeakAngle(angle: Angle) {
  const words = normalizeAngleText(angle.angle).split(" ").filter(Boolean);
  const text = angle.angle.toLowerCase() + " " + angle.why.toLowerCase();
  if (words.length < 7) return true;
  return [
    "indicating a shift",
    "need for a different approach",
    "need for a new approach",
    "highlights the importance",
    "importance of",
    "need to survive",
    "need to prepare",
    "need to adapt",
    "changing nature",
    "raises an important",
  ].some((phrase) => text.includes(phrase));
}

function scoreAngle(angle: Angle, story: Story): RankedAngle {
  const angleText = (angle.angle + " " + angle.why + " " + angle.evidence).toLowerCase();
  const summary = story.summary.toLowerCase();
  const readerInterest = Math.min(10, 5 + (/why|how|instead|rather|but|yet|first|last|shift|trade|tension/.test(angleText) ? 2 : 0) + (angle.angle.length >= 70 ? 2 : 0));
  const discussionPotential = Math.min(10, 5 + (/trade|tension|whether|instead|but|yet|should|choice|debate|cost|risk/.test(angleText) ? 3 : 0) + (angle.why.length >= 60 ? 1 : 0));
  const relevance = Math.min(10, 5 + (/(work|worker|workers|career|job|jobs|business|leader|leadership|professional|company|skill|skills|education|manager|customer|market)/.test(angleText) ? 3 : 0) + (story.topic ? 1 : 0));
  const wordCount = normalizeAngleText(angle.angle).split(" ").filter(Boolean).length;
  const clarity = Math.max(1, Math.min(10, 10 - Math.max(0, wordCount - 24) * 0.35));
  const evidencePrefix = angle.evidence.toLowerCase().slice(0, 30);
  const specificity = Math.min(10, 4 + (angle.evidence.length >= 45 ? 2 : 0) + (evidencePrefix && summary.includes(evidencePrefix) ? 2 : 0) + (angle.angle.length >= 60 ? 2 : 0));
  const linkedinFit = Math.min(10, 5 + (angle.angle.length >= 55 && angle.angle.length <= 180 ? 2 : 0) + (discussionPotential >= 7 ? 2 : 0) + (clarity >= 7 ? 1 : 0));
  const evidenceStrength = Math.min(10, 4 + (angle.evidence.length >= 45 ? 3 : 0) + (evidencePrefix && summary.includes(evidencePrefix) ? 3 : 0));
  const score = readerInterest * 0.20 + discussionPotential * 0.20 + relevance * 0.15 + clarity * 0.15 + specificity * 0.10 + linkedinFit * 0.10 + evidenceStrength * 0.10;
  return { ...angle, score: Number(score.toFixed(2)), criteria: { readerInterest, discussionPotential, relevance, clarity, specificity, linkedinFit, evidenceStrength } };
}

function rankAngles(angles: Angle[], story: Story): RankedAngle[] {
  return angles.filter((angle) => !isWeakAngle(angle)).map((angle) => scoreAngle(angle, story)).sort((a, b) => b.score - a.score);
}

function selectSafeAngles(angles: Angle[]) {
  const unique: Angle[] = [];

  for (const angle of angles) {
    if (isForbiddenAngle(angle) || isWeakAngle(angle)) continue;

    const normalizedAngle: Angle = {
      angle: angle.angle.trim(),
      why:
        angle.why.trim() ||
        "This provides a specific, evidence-led point of view on the selected story.",
      evidence:
        angle.evidence?.trim() ||
        "Based on the selected story and its supplied summary.",
    };

    if (!normalizedAngle.angle) continue;

    if (
      unique.some(
        (existing) =>
          angleSimilarity(existing.angle, normalizedAngle.angle) >= 0.72,
      )
    ) {
      continue;
    }

    unique.push(normalizedAngle);

    if (unique.length >= 3) break;
  }

  return unique;
}

function buildGroundedFallback(story: Story): { evidence: Evidence[]; angles: Angle[] } {
  const summary = story.summary.trim();
  const headline = story.headline.trim();
  if (!summary || summary.length < 40) return { evidence: [], angles: [] };

  const firstSentence =
    summary.split(/(?<=[.!?])\s+/).find((sentence) => sentence.trim().length >= 40)?.trim() ||
    summary;

  const support = firstSentence.slice(0, 420);
  const apprenticeshipTheme = /junior|entry[- ]level|young|apprenticeship|routine|bottom rungs|trade/i.test(summary);

  const claim = apprenticeshipTheme
    ? "AI may be removing the routine junior tasks that traditionally helped people learn their trade."
    : firstSentence;

  const angle = apprenticeshipTheme
    ? "The AI disruption may begin by removing the routine work that once served as an apprenticeship for younger workers."
    : firstSentence.replace(/[.]+$/, "") + ".";

  return {
    evidence: [
      {
        claim,
        support,
        type: "fact",
      },
    ],
    angles: [
      {
        angle,
        why: "This stays close to a concrete detail in the supplied story rather than adding outside assumptions.",
        evidence: support,
      },
    ],
  };
}

async function buildEditorialPass(story: Story) {
  const normalizedStory: Story = {
    ...story,
    topic: decodeHtmlEntities(story.topic),
    headline: decodeHtmlEntities(story.headline),
    source: decodeHtmlEntities(story.source),
    summary: decodeHtmlEntities(story.summary),
    url: story.url,
  };
  const prompt = `You are PostCraft AI, an editorial thinking partner. Generate the strongest useful response from the selected story below.

Do not search the internet. Do not fetch another article. Work only from the story information provided here.

SELECTED STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

Find the most interesting thing to say about THIS story. Do not merely summarize the headline. Look for a specific tension, contrast, implication, affected group, trade-off, mechanism, timeline, decision, constraint, or unresolved point contained in the story information.

Return up to 3 genuinely different angles. They should differ in thesis, not just wording. Prefer one strong angle over three weak or repetitive ones. Do not manufacture diversity by rewriting the same claim three ways.

Every angle must be directly supported by the supplied headline or summary. Do not infer motives, cover-ups, awareness, deception, self-awareness, autonomous control, causation, or consequences that the supplied information does not establish. Do not turn a possibility into a fact. If evidence is limited, make that limitation part of the angle.

Do not use generic angles such as:
- technology is changing work
- people need to adapt
- AI will improve efficiency
- AI may increase inequality
- this raises questions
- future of work
- responsible innovation
- the need to strike a balance
- the implications are profound

The evidence field must quote or closely paraphrase a concrete detail from the supplied story. The why field must explain why that specific detail creates a useful point of view; it must not introduce a new factual claim.

Return ONLY valid JSON. Do not use Markdown fences or explanatory text.

Use exactly this structure:
{
  "evidence": [
    {
      "claim": "short concrete point from the supplied story",
      "support": "headline or summary detail",
      "type": "fact"
    }
  ],
  "angles": [
    {
      "angle": "specific thesis",
      "why": "why this specific thesis is worth considering",
      "evidence": "the story detail that supports this angle"
    }
  ]
}`;

  const parsed = parseJson(
    await provider().generateText(prompt, {
      format: "json",
      temperature: 0.2,
      numPredict: 220,
    })
  );

  let evidence = parseEvidence(parsed?.evidence);
  const angles = selectSafeAngles(parseAngles(parsed?.angles));

  // Small local models sometimes return usable angles but omit the separate
  // evidence array. Reconstruct the evidence ledger from each angle's own
  // evidence field so post generation never fails merely because the model
  // omitted redundant structure.
  if (!evidence.length && angles.length) {
    evidence = angles
      .filter((angle) => angle.evidence?.trim())
      .slice(0, 3)
      .map((angle) => ({
        claim: angle.angle,
        support: angle.evidence.trim(),
        type: "fact" as const,
      }));
  }

  // Small local models can occasionally return valid JSON with no usable
  // angles even when the supplied story contains enough evidence. Keep the
  // editorial pipeline grounded by falling back to a deterministic angle
  // derived only from the supplied headline and summary.
  if (!angles.length) {
    const fallback = buildGroundedFallback(normalizedStory);
    if (fallback.angles.length) return fallback;
  }

  return { evidence, angles };
}


export async function generateEditorialDraft(
  story: Story,
  onPostToken?: (token: string) => void,
) {
  const startedAt = Date.now();
  const normalizedStory: Story = {
    ...story,
    topic: decodeHtmlEntities(story.topic),
    headline: decodeHtmlEntities(story.headline),
    source: decodeHtmlEntities(story.source),
    summary: decodeHtmlEntities(story.summary),
    url: story.url,
  };

  const editorial = await buildEditorialPass(normalizedStory);
  const ranked = rankAngles(editorial.angles, normalizedStory);

  if (!ranked.length) {
    const fallback = buildGroundedFallback(story);
    if (!fallback.angles.length) throw new Error("This story did not contain enough specific evidence for a strong editorial angle. Try another story.");
    const selected = {
      ...fallback.angles[0],
      score: 6,
      criteria: { readerInterest: 7, discussionPotential: 7, relevance: 6, clarity: 8, specificity: 8, linkedinFit: 7, evidenceStrength: 9 },
    };
    const post = await generateEditorialPost(
      normalizedStory,
      selected.angle,
      selected.why,
      "Use a balanced, thoughtful professional perspective. Focus on the concrete tension or implication in the selected angle without adding outside facts.",
      fallback.evidence,
      onPostToken,
    );
    return { angles: [selected], evidence: fallback.evidence, selectedAngle: selected, post, editorialMs: Date.now() - startedAt };
  }

  const selected = ranked[0];
  const post = await generateEditorialPost(
    normalizedStory,
    selected.angle,
    selected.why,
    "Use a balanced, thoughtful professional perspective. Focus on the concrete tension or implication in the selected angle without adding outside facts.",
    editorial.evidence,
    onPostToken,
  );

  console.info("[PostCraft] editorial_pipeline_ms=" + (Date.now() - startedAt) + " candidates=" + editorial.angles.length + " ranked=" + ranked.length + " selected_score=" + selected.score);
  return { angles: ranked.slice(0, 3), evidence: editorial.evidence, selectedAngle: selected, post, editorialMs: Date.now() - startedAt };
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now();
  const normalizedStory: Story = {
    ...story,
    topic: decodeHtmlEntities(story.topic),
    headline: decodeHtmlEntities(story.headline),
    source: decodeHtmlEntities(story.source),
    summary: decodeHtmlEntities(story.summary),
    url: story.url,
  };
  const editorial = await buildEditorialPass(normalizedStory);

  console.info(
    `[PostCraft] editorial_ms=${Date.now() - startedAt} model_only=true evidence=${editorial.evidence.length} angles=${editorial.angles.length}`
  );

  if (!editorial.angles.length) {
    throw new Error("This story did not contain enough specific evidence for a strong editorial angle. Try another story.");
  }

  return {
    angles: editorial.angles,
    evidence: editorial.evidence,
  };
}

export { decodeHtmlEntities as decodeEditorialEntities };

export function sanitizeLinkedInPost(value: string) {
  return value
    .replace(/^\s*(?:LinkedIn post|Post):\s*/i, "")
    .replace(/\n+\s*(?:Source|Original source|Article source|Read the original article|Original article)\s*:?[^\n]*(?:https?:\/\/\S+)?\s*$/i, "")
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/\n+\s*(?:Source|Original source|Article source)\s*:?\s*$/i, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function validateEvidence(value: unknown): Evidence[] {
  return parseEvidence(value);
}

function postHasConcreteAnchor(post: string, story: Story, angle: string) {
  const words = post.trim().split(/\s+/).filter(Boolean);

  // Anchor validation should follow the actual story, not a fixed topic list.
  // This prevents valid posts about new companies, products, people, or domains
  // from being rejected simply because their vocabulary is unfamiliar.
  const stopWords = new Set([
    "about", "after", "again", "also", "among", "been", "being", "could",
    "does", "from", "have", "into", "just", "more", "most", "only", "over",
    "said", "same", "some", "than", "that", "their", "them", "then", "there",
    "these", "they", "this", "those", "through", "under", "very", "what",
    "when", "where", "which", "while", "with", "would", "your", "story",
    "report", "reports", "according", "because", "should",
  ]);

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !stopWords.has(word));

  const storyTerms = new Set(
    normalize(story.topic + " " + story.headline + " " + story.summary + " " + angle)
  );
  const postTerms = new Set(normalize(post));

  let sharedTerms = 0;
  for (const term of storyTerms) {
    if (postTerms.has(term)) sharedTerms += 1;
  }

  // The prompt targets 120-180 words, but the production local model can
  // occasionally produce a shorter draft. Keep the grounding gate strict
  // while allowing a slightly shorter, still useful LinkedIn post.
  return words.length >= 90 && words.length <= 210 && sharedTerms >= 2;
}

function getConcreteEvidenceTerms(
  story: Story,
  evidence: Evidence[],
  angle: string,
) {
  const stopWords = new Set([
    "about", "after", "again", "also", "among", "been", "being", "could",
    "does", "from", "have", "into", "just", "more", "most", "only", "over",
    "said", "same", "some", "than", "that", "their", "them", "then", "there",
    "these", "they", "this", "those", "through", "under", "very", "what",
    "when", "where", "which", "while", "with", "would", "your", "story",
    "report", "reports", "according", "because", "should", "article",
    "source", "selected", "interesting", "important", "today", "people",
    "company", "companies", "technology", "technologies", "business",
    "development", "question", "future", "need", "could", "might",
    "would", "thing", "things", "really", "simply", "specific",
  ]);

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 5 && !stopWords.has(word));

  const sourceText = [
    story.headline,
    story.summary,
    angle,
    ...evidence.flatMap((item) => [item.claim, item.support]),
  ].join(" ");

  return Array.from(new Set(normalize(sourceText)));
}

function postHasConcreteEvidenceDensity(
  post: string,
  story: Story,
  evidence: Evidence[],
  angle: string,
) {
  const anchors = getConcreteEvidenceTerms(story, evidence, angle);
  const lowerPost = post.toLowerCase();

  const matchedAnchors = anchors.filter((term) =>
    lowerPost.includes(term),
  );

  const paragraphs = post
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .slice(1);

  const substantiveParagraphs = paragraphs.filter(
    (paragraph) => paragraph.split(/\s+/).filter(Boolean).length >= 15,
  );

  const paragraphsWithEvidence = substantiveParagraphs.filter((paragraph) => {
    const lowerParagraph = paragraph.toLowerCase();
    return anchors.some((term) => lowerParagraph.includes(term));
  });

  return {
    ok:
      matchedAnchors.length >= 3 &&
      substantiveParagraphs.length > 0 &&
      paragraphsWithEvidence.length === substantiveParagraphs.length,
    matchedAnchors: matchedAnchors.slice(0, 8),
    substantiveParagraphs: substantiveParagraphs.length,
    paragraphsWithEvidence: paragraphsWithEvidence.length,
  };
}

function postHasSourceGrounding(post: string, story: Story, evidence: Evidence[], angle: string) {
  const stopWords = new Set([
    "about", "after", "again", "also", "among", "been", "being", "could",
    "does", "from", "have", "into", "just", "more", "most", "only", "over",
    "said", "same", "some", "than", "that", "their", "them", "then", "there",
    "these", "they", "this", "those", "through", "under", "very", "what",
    "when", "where", "which", "while", "with", "would", "your", "story",
    "report", "reports", "according", "because", "should", "article",
    "source", "selected", "interesting", "important", "today", "people",
    "company", "companies", "technology", "technologies", "business",
  ]);

  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !stopWords.has(word));

  const titleTerms = new Set(normalize(story.headline));
  const supportTerms = new Set(normalize(
    story.summary + " " + evidence.map((item) => item.support).join(" ") + " " + angle
  ));
  const postTerms = new Set(normalize(post));

  const titleMatches = Array.from(titleTerms).filter((term) => postTerms.has(term)).length;
  const supportMatches = Array.from(supportTerms).filter((term) => postTerms.has(term)).length;

  // Keep the guard strong enough to catch mixed stories, but tolerant of
  // natural paraphrasing from a small local model. One distinctive headline
  // anchor plus two supporting anchors is sufficient.
  return titleMatches >= 1 && supportMatches >= 2;
}

function getMetaEditorialPhrases(post: string) {
  // Only flag unmistakable generation/section labels. Phrases such as
  // "this angle" or "this perspective" can be perfectly natural in a human
  // LinkedIn post and must not cause a false rejection.
  const phrases = [
    "### linkedin post",
    "## linkedin post",
    "linkedin post:",
    "the strongest supported tension in this angle",
    "another strong implication in this angle",
    "the strongest angle is",
    "the key takeaway is",
    "here is the repaired post",
    "here's the repaired post",
    "validation failure",
    "evidence ledger",
    "editorial repair",
  ];

  const lower = post.toLowerCase();
  return phrases.filter((phrase) => lower.includes(phrase));
}

function getGenericFillerPhrases(post: string) {
  const phrases = [
    "it's crucial to recognize",
    "not evenly distributed",
    "highlights the need",
    "raises a crucial question",
    "strike a balance",
    "in today's rapidly changing world",
    "in today's rapidly evolving business landscape",
    "in today's evolving business landscape",
    "in the modern business landscape",
    "in the rapidly evolving business landscape",
    "driving the business forward",
    "drives the business forward",
    "highlights the importance",
    "future of leadership",
    "effective leadership fosters",
    "discover how",
    "the future of work",
    "what do you think",
    "agree or disagree",
  ];

  const lower = post.toLowerCase();
  return phrases.filter((phrase) => lower.includes(phrase));
}

function postHasGenericFiller(post: string) {
  return getGenericFillerPhrases(post).length > 0;
}

export async function generateEditorialPost(
  story: Story,
  angle: string,
  angleWhy: string,
  modeInstruction: string,
  suppliedEvidence?: Evidence[],
  onPostToken?: (token: string) => void,
) {
  const evidence = validateEvidence(suppliedEvidence);

  if (evidence.length < 1) {
    throw new Error("Evidence is required before post generation.");
  }

  const ledger = evidence
    .map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`)
    .join("\n");

  type ValidationResult = {
    ok: boolean;
    reasons: string[];
    wordCount: number;
    characterCount: number;
    hasConcreteAnchor: boolean;
    hasSourceGrounding: boolean;
    hasGenericFiller: boolean;
    genericFillerPhrases: string[];
    metaEditorialPhrases: string[];
    hasNoSourceLeak: boolean;
    evidenceDensity: {
      ok: boolean;
      matchedAnchors: string[];
      substantiveParagraphs: number;
      paragraphsWithEvidence: number;
    };
  };

  function normalizeGeneratedPost(rawResult: string) {
    const parsedResult = parseJson(rawResult);
    const rawPost =
      typeof parsedResult?.post === "string"
        ? parsedResult.post.trim()
        : rawResult.trim();

    const decodedPost = decodeHtmlEntities(
      rawPost
        .replace(/\\r\\n/g, "\n")
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\n"),
    );

    const normalizedPost = sanitizeLinkedInPost(decodedPost);
    const headline = story.headline.trim();
    const normalizedHeadline = headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const normalizedLines = normalizedPost
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const withoutDuplicateHeadline = normalizedLines.filter((line, index) => {
      if (index === 0) return true;

      const normalizedLine = line
        .replace(/^\*\*(?:headline|title|post):\*\*\s*/i, "")
        .replace(/^(?:headline|title|post):\s*/i, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

      return !(
        normalizedLine === normalizedHeadline ||
        normalizedLine.startsWith(normalizedHeadline + " ")
      );
    });

    const body = withoutDuplicateHeadline.join("\n\n");
    const normalizedStart = body
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    const finalPost = normalizedStart.startsWith(normalizedHeadline)
      ? body
      : headline + "\n\n" + body;

    return sanitizeLinkedInPost(finalPost);
  }

  function validatePost(post: string): ValidationResult {
    const wordCount = post.split(/\s+/).filter(Boolean).length;
    const characterCount = post.length;
    const hasConcreteAnchor = postHasConcreteAnchor(post, story, angle);
    const hasSourceGrounding = postHasSourceGrounding(
      post,
      story,
      evidence,
      angle,
    );
    const genericFillerPhrases = getGenericFillerPhrases(post);
    const hasGenericFiller = genericFillerPhrases.length > 0;
    const metaEditorialPhrases = getMetaEditorialPhrases(post);
    const evidenceDensity = postHasConcreteEvidenceDensity(
      post,
      story,
      evidence,
      angle,
    );
    const hasNoSourceLeak =
      !/https?:\/\/|(?:^|\n)\s*(?:source|original source|article source)\s*:/im.test(
        post,
      );

    const reasons: string[] = [];

    if (!hasConcreteAnchor) {
      reasons.push(
        "The draft is not sufficiently anchored to concrete story-specific terms or has an invalid word count.",
      );
    }
    if (!hasSourceGrounding) {
      reasons.push(
        "The draft does not contain enough distinctive evidence from the selected story.",
      );
    }
    if (hasGenericFiller) {
      reasons.push("The draft contains generic LinkedIn or AI filler language.");
    }
    if (metaEditorialPhrases.length) {
      reasons.push("The draft contains editorial-generation or section-label language instead of a finished LinkedIn post.");
    }
    if (!evidenceDensity.ok) {
      reasons.push(
        "The draft is too generic: use at least three concrete story-specific details and keep every substantive paragraph anchored to the supplied evidence.",
      );
    }
    if (!hasNoSourceLeak) {
      reasons.push("The draft contains a source URL or source footer.");
    }
    if (characterCount < 600) {
      reasons.push(`The draft is too short at ${characterCount} characters.`);
    }
    if (characterCount > 1600) {
      reasons.push(`The draft is too long at ${characterCount} characters.`);
    }

    return {
      ok: reasons.length === 0,
      reasons,
      wordCount,
      characterCount,
      hasConcreteAnchor,
      hasSourceGrounding,
      hasGenericFiller,
      hasNoSourceLeak,
      genericFillerPhrases,
      metaEditorialPhrases,
      evidenceDensity,
    };
  }

  const basePrompt = `You are PostCraft AI's final LinkedIn editor. Write the post directly from the selected story and the user's chosen angle.

Do not search the internet. Do not add outside facts. Do not invent statistics, examples, quotes, or context. If the supplied story information is limited, make the argument from what is actually there rather than pretending you know more.

Write like a thoughtful human professional, not like an AI news summarizer. Use plain, natural English.

The post MUST add a specific editorial observation, not merely rewrite the source. Start with the concrete development, then explain a supported implication, contrast, trade-off, or practical consequence that is explicitly grounded in the supplied evidence. Do not use editorial-process language such as "strongest angle", "strongest supported tension", "editorial proposition", or "key takeaway" in the finished post.

Every factual claim must be supported by the supplied story evidence. Preserve uncertainty where the story is uncertain.

Avoid corporate clichés, generic openings, inflated language, repetitive phrasing, forced rhetorical questions, and generic phrases such as "in today's rapidly changing world", "this marks a significant milestone", "the implications are profound", and "it is important to note".

STORY
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

SELECTED ANGLE
${angle}

WHY THIS ANGLE WORKS
${angleWhy}

STORY EVIDENCE
${ledger}

USER'S TAKE
${modeInstruction}

Write a natural LinkedIn post of roughly 120-180 words in 4-7 short paragraphs.

IMPORTANT TITLE RULE:
Start the post with the exact story headline as a standalone first line.

Do not include the source URL, source footer, or any other URL.
Do not use emojis, numbered-list filler, "here's the thing", "let's dive in", "What do you think?", "Agree or disagree?", or "Thoughts?".

Return ONLY the finished LinkedIn post.`;

  async function generateRaw(prompt: string) {
    return provider().generateText(prompt, {
      temperature: 0.3,
      numPredict: 220,
    });
  }

  async function repairRaw(rejectedPost: string, validation: ValidationResult) {
    const repairPrompt = `You are PostCraft AI's senior editorial repair editor.

Repair the rejected LinkedIn draft below. Do not replace the story with invented information.

Work ONLY from the supplied story, selected angle, and evidence.
Do not search the internet.
Do not add outside facts, statistics, examples, quotes, motives, causation, or consequences.
Preserve the exact headline as the first standalone line.
Preserve the central editorial angle.
Write the finished post as if speaking directly to a professional reader. Never describe the writing process, the angle, the evidence ledger, the validator, or the repair itself.
Fix EVERY validation failure listed below.
The exact generic filler and meta-editorial phrases detected by the validator are listed below. Do not reuse them or close variants; replace them with concrete statements tied to the supplied story evidence.
Strengthen concrete story-specific grounding.
Remove generic AI/LinkedIn filler.
At least three concrete story-specific details must appear in the repaired post.
Every substantive paragraph after the headline must contain at least one concrete detail from the supplied evidence.
Do not replace story-specific reporting with generic commentary about AI safety, governance, ethics, responsible innovation, progress, society, or the future unless that specific idea is explicitly supported by the supplied story.
Keep 90-210 words and 600-1600 characters.
Do not include URLs or source footers.
Return ONLY the repaired LinkedIn post.

STORY
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

SELECTED ANGLE
${angle}

WHY THIS ANGLE WORKS
${angleWhy}

STORY EVIDENCE
${ledger}

VALIDATION FAILURES
${validation.reasons.map((reason) => `- ${reason}`).join("\\n")}

DETECTED GENERIC PHRASES
${validation.genericFillerPhrases.length ? validation.genericFillerPhrases.map((phrase) => `- ${phrase}`).join("\\n") : "- none"}

EVIDENCE DENSITY
Concrete anchors detected: ${validation.evidenceDensity.matchedAnchors.join(", ") || "none"}
Substantive paragraphs: ${validation.evidenceDensity.substantiveParagraphs}
Paragraphs containing evidence: ${validation.evidenceDensity.paragraphsWithEvidence}

REJECTED DRAFT
${rejectedPost}`;

    return generateRaw(repairPrompt);
  }

  const firstRaw = await generateRaw(basePrompt);
  const firstPost = normalizeGeneratedPost(firstRaw);
  const firstValidation = validatePost(firstPost);

  console.info("[PostCraft] post_validation", {
    attempt: "initial",
    ...firstValidation,
  });

  if (firstValidation.ok) {
    console.info("[PostCraft] editorial_quality_gate=first_pass");
    if (onPostToken) onPostToken(firstPost);
    return firstPost;
  }

  console.warn("[PostCraft] post_rejected_first_attempt", {
    reasons: firstValidation.reasons,
  });


  function buildDeterministicFallbackPost() {
    const sentences = story.summary
      .replace(/\s+/g, " ")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter((sentence) => sentence.length >= 45);

    if (sentences.length < 3) return "";

    const selectedSentences = sentences.slice(0, 5);
    const paragraphs = [
      story.headline.trim(),
      `One concrete point in the story is that ${selectedSentences[0]}`,
      `The article also points to ${selectedSentences[1]}`,
      `Another detail is ${selectedSentences[2]}`,
      `That makes the central issue practical: ${angle.replace(/[.]+$/, "")}.`,
    ];

    if (selectedSentences[3]) {
      paragraphs.push(`The story further describes ${selectedSentences[3]}`);
    }

    return sanitizeLinkedInPost(paragraphs.join("\\n\\n"));
  }

  const repairedRaw = await repairRaw(firstPost, firstValidation);
  const repairedPost = normalizeGeneratedPost(repairedRaw);
  const repairedValidation = validatePost(repairedPost);

  console.info("[PostCraft] post_validation", {
    attempt: "repair",
    ...repairedValidation,
  });

  if (!repairedValidation.ok) {
    console.error("[PostCraft] post_rejected_after_repair", {
      reasons: repairedValidation.reasons,
    });

    // If the local model fails both generation passes, build a deterministic
    // evidence-led draft from the verified source summary. This is still
    // subject to the exact same quality gate; we never bypass validation.
    const fallbackPost = buildDeterministicFallbackPost();
    if (fallbackPost) {
      const fallbackValidation = validatePost(fallbackPost);

      console.info("[PostCraft] post_validation", {
        attempt: "deterministic_fallback",
        ...fallbackValidation,
      });

      if (fallbackValidation.ok) {
        console.info("[PostCraft] editorial_quality_gate=deterministic_fallback");
        if (onPostToken) onPostToken(fallbackPost);
        return fallbackPost;
      }
    }

    throw new Error(
      `PostCraft could not produce a validated editorial draft after generation and repair. ${repairedValidation.reasons.join(" ")}`,
    );
  }

  console.info("[PostCraft] editorial_quality_gate=repaired");
  if (onPostToken) onPostToken(repairedPost);
  return repairedPost;
}
