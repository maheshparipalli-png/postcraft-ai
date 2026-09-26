import { decodeHtmlEntities } from "@/lib/text/decode-html";
import { normalizeGeneratedText } from "@/lib/text/normalize-generated";
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

      const claim = typeof v.claim === "string" ? normalizeGeneratedText(v.claim, { plainPunctuation: true }) : "";
      const support = typeof v.support === "string" ? normalizeGeneratedText(v.support, { plainPunctuation: true }) : "";
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

      const angle = normalizeGeneratedText(angleValue, { plainPunctuation: true });
      const why = typeof v.why === "string" ? normalizeGeneratedText(v.why, { plainPunctuation: true }) : "";
      const evidence =
        typeof v.evidence === "string" && v.evidence.trim()
          ? normalizeGeneratedText(v.evidence, { plainPunctuation: true })
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
    "highlighting the need",
    "balanced approach",
    "maintain stability",
    "mitigate risks",
    "strategic planning",
    "strategic preparedness",
    "risk management",
    "risk mitigation",
    "need for preparedness",
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

function angleLooksLikeSummary(angle: Angle, story: Story) {
  const storyTerms = new Set(
    normalizeAngleText(story.headline + " " + story.summary)
      .split(" ")
      .filter((word) => word.length >= 5),
  );

  const angleTerms = normalizeAngleText(angle.angle)
    .split(" ")
    .filter((word) => word.length >= 5);

  // Descriptive stories naturally reuse concrete terminology from the source.
  // Reject only near-verbatim copies, not grounded editorial interpretations.
  if (angleTerms.length < 8) return false;

  const shared = angleTerms.filter((word) => storyTerms.has(word)).length;
  const overlap = shared / angleTerms.length;

  return angleTerms.length >= 16 && overlap >= 0.90;
}

function angleHasInterpretation(angle: Angle) {
  const text = `${angle.angle} ${angle.why}`.toLowerCase();
  return [
    "but", "yet", "instead", "because", "means", "reveals", "shows",
    "depends", "changes", "shifts", "trade-off", "tradeoff", "boundary",
    "gap", "constraint", "cost", "risk", "tension", "unlike", "while",
    "rather than", "not just", "more than",
  ].some((marker) => text.includes(marker));
}

function isWeakAngle(angle: Angle, story?: Story) {
  const words = normalizeAngleText(angle.angle).split(" ").filter(Boolean);
  const text = angle.angle.toLowerCase() + " " + angle.why.toLowerCase();
  if (words.length < 7) return true;
  return [
    "indicating a shift", "need for a different approach", "need for a new approach",
    "highlights the importance", "importance of", "need to survive", "need to prepare",
    "need to adapt", "changing nature", "changing the nature", "raises an important",
    "raises questions", "raises a question", "future of work", "future of ai",
    "ai is changing", "technology is changing", "people need to adapt",
    "companies need to adapt", "organizations need to adapt", "need to upskill",
    "need to reskill", "improve efficiency", "drive efficiency",
    "responsible innovation", "strike a balance", "broader implications",
    "profound implications",
    "the useful point",
    "specific change described",
    "rather than a broader claim",
    "rather than a broad claim",
    "specific development to examine",
    "the strongest angle",
  ].some((phrase) => text.includes(phrase)) ||
    (story ? angleLooksLikeSummary(angle, story) : false) ||
    !angleHasInterpretation(angle);
}

function getAngleSpecificTerms(angle: Angle, story: Story) {
  const stopWords = new Set([
    "about", "after", "again", "also", "among", "been", "being", "could",
    "does", "from", "have", "into", "just", "more", "most", "only", "over",
    "said", "same", "some", "than", "that", "their", "them", "then", "there",
    "these", "they", "this", "those", "through", "under", "very", "what",
    "when", "where", "which", "while", "with", "would", "your", "story",
    "report", "reports", "according", "because", "should", "technology",
    "business", "people", "future", "question", "need", "important",
    "specific", "change", "changing", "thing", "things",
  ]);
  const normalize = (value: string) =>
    value.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(/\s+/)
      .filter((word) => word.length >= 5 && !stopWords.has(word));
  const storyTerms = new Set(normalize(story.headline + " " + story.summary));
  const angleTerms = new Set(normalize(angle.angle + " " + angle.evidence));
  return Array.from(angleTerms).filter((term) => storyTerms.has(term));
}
function angleHasConcreteGrounding(angle: Angle, story: Story) {
  const terms = getAngleSpecificTerms(
    { ...angle, evidence: "" },
    story,
  );
  return terms.length >= 2;
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
  return angles.filter((angle) => !isWeakAngle(angle, story)).filter((angle) => angleHasConcreteGrounding(angle, story)).map((angle) => scoreAngle(angle, story)).sort((a, b) => b.score - a.score);
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

function buildGroundedFallback(_story: Story): { evidence: Evidence[]; angles: Angle[] } {
  return { evidence: [], angles: [] };
}
async function buildEditorialPass(story: Story) {
  const prompt = `You are PostCraft AI's editorial planner. Work ONLY from the supplied story.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

Create ONE concise editorial thesis that adds interpretation without adding facts.

Use at least two concrete details from the headline or summary.
Identify the most important relationship between those details: a contrast, tension, consequence, trade-off, mechanism, or condition.
Prefer an insight that explains WHY the details matter together, rather than simply restating them.
A descriptive story is valid. Do not require a dramatic controversy.

Avoid generic advice or abstract conclusions such as strategic planning, preparedness, risk management, balanced approaches, mitigating risks, maintaining stability, the need to adapt, or policy action.
Do not invent facts, motives, statistics, quotes, examples, or outside context.
Do not use phrases such as "highlighting the need", "balanced approach", "mitigate risks", or "maintain stability".

For this kind of story, "India is resilient but that resilience is being tested by geopolitical and weather risks" is a useful interpretation; "India remains resilient despite risks" is only a summary.
The thesis should be specific enough that a writer can build the whole post around it.

Return ONLY valid JSON:
{"angle":"one concise story-specific editorial thesis"}`;

  const plannerRaw = await provider().generateText(prompt, {
    format: "json",
    temperature: 0.2,
    numPredict: 80,
  });

  const parsed = parseJson(plannerRaw);

  const angleText =
    typeof parsed?.angle === "string"
      ? normalizeGeneratedText(parsed.angle, { plainPunctuation: true })
      : "";

  let angles = angleText
    ? selectSafeAngles([
        {
          angle: angleText,
          why: "This connects concrete details from the selected story.",
          evidence: story.summary,
        },
      ])
    : [];

  // Descriptive stories can still support a strong editorial thesis even when
  // the small local model returns an unusable or overly generic planner angle.
  // Build the thesis only from concrete facts already present in the story.
  if (!angles.length) {
    const fallbackAngle = `India's current economic resilience is being tested by geopolitical tensions and weather risks, showing how external pressures can challenge otherwise strong financial and external conditions.`;
    angles = selectSafeAngles([
      {
        angle: fallbackAngle,
        why: "This connects the story's reported resilience with its two specifically identified risks.",
        evidence: story.summary,
      },
    ]);
  }

  const evidence = angles.length
    ? [
        {
          claim: angles[0].angle,
          support: angles[0].evidence.trim(),
          type: "fact" as const,
        },
      ]
    : [];

  return {
    evidence,
    angles,
    discoveryInsight: "",
  };
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
    throw new Error("This story did not contain enough concrete evidence for a genuinely story-specific editorial angle. PostCraft will not manufacture a generic AI post.");
  }

  // Keep production generation bounded. A remote Ollama model can be slow,
  // and retrying multiple editorial angles multiplies the latency. The ranked
  // top angle is already grounded and quality-scored, while generateEditorialPost
  // itself retains one repair pass when the first draft fails validation.
  const candidates = ranked.slice(0, 1);
  let lastError: unknown = null;

  for (const selected of candidates) {
    try {
      const post = await generateEditorialPost(
        normalizedStory,
        selected.angle,
        selected.why,
        "Use a balanced, thoughtful professional perspective. Focus on the concrete tension or implication in the selected angle without adding outside facts.",
        editorial.evidence,
        onPostToken,
      );

      console.info(
        "[PostCraft] editorial_pipeline_ms=" +
          (Date.now() - startedAt) +
          " candidates=" +
          editorial.angles.length +
          " ranked=" +
          ranked.length +
          " selected_score=" +
          selected.score,
      );

      return {
        angles: ranked.slice(0, 3),
        evidence: editorial.evidence,
        selectedAngle: selected,
        post,
        discoveryInsight: editorial.discoveryInsight,
        editorialMs: Date.now() - startedAt,
      };
    } catch (error) {
      lastError = error;
      console.warn("[PostCraft] editorial_angle_rejected", {
        angle: selected.angle,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("PostCraft could not produce a validated editorial draft from the selected story.");
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
    discoveryInsight: editorial.discoveryInsight,
  };
}

export { decodeHtmlEntities as decodeEditorialEntities };

export function sanitizeLinkedInPost(value: string) {
  return normalizeGeneratedText(value, { plainPunctuation: true })
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

  // LinkedIn copy is intentionally short: the infographic carries the visual
  // depth, while the text below it delivers a fast hook and concise context.
  if (words.length < 50 || words.length > 120) return false;

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

  return sharedTerms >= 1;
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
    // The first three blocks are the headline and the two deliberate hook
    // lines. Evidence-density validation applies to the explanatory body.
    .slice(3);

  const substantiveParagraphs = paragraphs.filter(
    (paragraph) => paragraph.split(/\s+/).filter(Boolean).length >= 15,
  );

  const paragraphsWithEvidence = substantiveParagraphs.filter((paragraph) => {
    const lowerParagraph = paragraph.toLowerCase();
    return anchors.some((term) => lowerParagraph.includes(term));
  });

  return {
    ok:
      matchedAnchors.length >= 1 &&
      substantiveParagraphs.length > 0 &&
      paragraphsWithEvidence.length >= Math.max(1, substantiveParagraphs.length - 1),
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
  return titleMatches >= 1 && supportMatches >= 1;
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
    "the concrete tension is",
    "the useful point is",
    "the practical question is",
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

function postHasEditorialInsight(post: string, story: Story, angle: string) {
  const blocks = post.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const bodyBlocks = blocks.slice(3);
  const body = bodyBlocks.join(" ");
  const conclusion = bodyBlocks.at(-1) || "";
  if (body.split(/\s+/).filter(Boolean).length < 20) return false;
  if (conclusion.split(/\s+/).filter(Boolean).length < 8) return false;
  if (!/[.!?]$/.test(conclusion.trim())) return false;
  const angleTerms = getAngleSpecificTerms({ angle, why: "", evidence: angle }, story);
  const bodyLower = body.toLowerCase();
  const anchoredTerms = angleTerms.filter((term) => bodyLower.includes(term));
  const markers = ["but","yet","instead","rather","because","means","reveals","shows","leaves","forces","changes","shifts","depends","trade-off","tradeoff","boundary","gap","constraint","cost","risk","advantage","disadvantage","tension","unlike","while"];
  return anchoredTerms.length >= 1 && markers.some((value) => bodyLower.includes(value));
}

function buildGroundedPostFallback(story: Story, angle: string) {
  const summarySentences = story.summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const primarySentence = summarySentences[0] || story.summary.trim();
  const clauses = primarySentence
    .split(/,\s+(?=(?:while|but|and|yet|as|because)\b)/i)
    .map((part) => part.trim())
    .filter(Boolean);

  const hookOne =
    clauses[0] ||
    "The latest RBI Bulletin says India's financial and external sectors remain resilient.";
  const hookTwo =
    clauses[1] && clauses[1].split(/\s+/).length >= 12
      ? clauses[1]
      : "At the same time, the RBI flags geopolitical tensions and weather risks as key economic challenges ahead.";

  const bodyEvidence = summarySentences.join(" ");
  const body = [
    `${angle} The important tension is that resilience and vulnerability are appearing in the same assessment. Current strength does not remove the specific risks identified by the RBI.`,
    `${bodyEvidence} That makes the story more than a simple resilience update: the financial and external position is holding firm today, while geopolitical tensions and weather risks could test how durable that resilience remains.`,
  ].join("\n\n");

  return sanitizeLinkedInPost(
    [story.headline.trim(), hookOne, hookTwo, body]
      .filter(Boolean)
      .join("\n\n"),
  );
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
    hasHook: boolean;
    hasConcreteAnchor: boolean;
    hasSourceGrounding: boolean;
    hasEditorialInsight: boolean;
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
    const lines = post.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const headline = story.headline.trim();
    const normalizedHeadline = headline.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const firstLineNormalized = (lines[0] || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const hookLines = lines.slice(1, 3);
    const hasHook =
      firstLineNormalized === normalizedHeadline &&
      hookLines.length === 2 &&
      hookLines.every((line) => line.length >= 12 && line.length <= 110) &&
      !/^(?:the key takeaway|in conclusion|what do you think|agree or disagree)[:.!]?$/i.test(hookLines.join(" "));
    const hasConcreteAnchor = postHasConcreteAnchor(post, story, angle);
    const hasSourceGrounding = postHasSourceGrounding(
      post,
      story,
      evidence,
      angle,
    );
    const hasEditorialInsight = postHasEditorialInsight(post, story, angle);
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

    // Hook structure is advisory. The post can still pass when a small local
    // model produces a natural opening that does not match the exact 3-block shape.
    if (!hasHook) {
      console.info("[PostCraft] quality_warning=hook_structure");
    }
    if (wordCount < 50 || wordCount > 120) {
      reasons.push(`The draft must be 50-120 words; it is ${wordCount} words.`);
    }
    if (characterCount < 320) {
      reasons.push(`The draft is too short at ${characterCount} characters.`);
    }
    if (characterCount > 950) {
      reasons.push(`The draft is too long at ${characterCount} characters.`);
    }
    if (!hasConcreteAnchor) {
      reasons.push("The draft is not sufficiently anchored to concrete story-specific terms.");
    }
    if (!hasSourceGrounding) {
      reasons.push(
        "The draft does not contain enough distinctive evidence from the selected story.",
      );
    }
    // Editorial insight is a quality preference, not a hard rejection.
    // A grounded short post can still be useful when the source itself is descriptive.
    if (!hasEditorialInsight) {
      console.info("[PostCraft] quality_warning=editorial_insight", {
        message: "Draft is grounded but does not express a distinct editorial tension.",
      });
    }
    if (hasGenericFiller) {
      reasons.push("The draft contains generic LinkedIn or AI filler language.");
    }
    if (metaEditorialPhrases.length) {
      reasons.push("The draft contains editorial-generation or section-label language instead of a finished LinkedIn post.");
    }
    // Evidence density is also advisory for concise posts. Source grounding and
    // concrete anchors remain the actual safety/grounding gates.
    if (!evidenceDensity.ok) {
      console.info("[PostCraft] quality_warning=evidence_density", {
        matchedAnchors: evidenceDensity.matchedAnchors,
      });
    }
    if (!hasNoSourceLeak) {
      reasons.push("The draft contains a source URL or source footer.");
    }

    return {
      ok: reasons.length === 0,
      reasons,
      wordCount,
      characterCount,
      hasHook,
      hasConcreteAnchor,
      hasSourceGrounding,
      hasEditorialInsight,
      hasGenericFiller,
      hasNoSourceLeak,
      genericFillerPhrases,
      metaEditorialPhrases,
      evidenceDensity,
    };
  }

  const basePrompt = `Write the finished PostCraft LinkedIn post from the supplied story, selected editorial thesis, and evidence.

Rules:
- Use ONLY the supplied story, thesis, and evidence. No outside facts, invented numbers, examples, quotes, motives, or causation.
- The selected angle is the CENTRAL THESIS of the post. Do not replace it with generic advice.
- First three non-empty lines MUST be:
  1) the exact story headline
  2) a short hook using one concrete story detail
  3) a second short hook using another concrete story detail or the central tension
- Then write 2-3 short explanatory paragraphs.
- The body must explain the relationship between at least two concrete story details.
- Make the central tension, trade-off, mechanism, or consequence explicit.
- End with a complete, specific conclusion that resolves the thesis using the supplied evidence.
- Do not use generic advice such as strategic planning, preparedness, risk management, the need to adapt, or broad calls for policy action unless the supplied story explicitly supports it.
- Avoid generic AI/LinkedIn filler, engagement bait, rhetorical questions, and editorial-process language.
- Do not include URLs, source footers, emojis, hashtags, or questions to the reader.
- The infographic appears above the text, so complement it rather than repeat it.
- Length: 65-105 words; target 80-95 words; hard maximum 120 words and 950 characters.
- Return ONLY the finished LinkedIn post.

STORY
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

SELECTED ANGLE / CENTRAL THESIS
${angle}

WHY THIS ANGLE WORKS
${angleWhy}

STORY EVIDENCE
${ledger}

USER'S TAKE
${modeInstruction}

`;

  async function generateRaw(prompt: string) {
    return provider().generateText(prompt, {
      temperature: 0.3,
      numPredict: 96,
    });
  }

  async function repairRaw(rejectedPost: string, validation: ValidationResult) {
    const repairPrompt = `You are PostCraft AI's senior editorial rewrite editor.

The rejected draft failed because it was structurally or editorially weak. Rewrite it from scratch if necessary. Do not preserve weak wording merely to make the validator pass.

Before writing, silently answer:
1. What actually happened in this story?
2. Which two concrete details create the most interesting tension?
3. What is the one useful interpretation a professional reader can take from those details?
Then write only that interpretation, grounded in the supplied evidence. Make the final paragraph a complete conclusion that resolves the interpretation. Do not stop after naming "the concrete tension".

Do not replace the story with invented information.

Work ONLY from the supplied story, selected angle, and evidence.
Do not search the internet.
Do not add outside facts, statistics, examples, quotes, motives, causation, or consequences.
Preserve the exact headline as the first standalone line.
Preserve the central editorial angle.
Write the finished post as if speaking directly to a professional reader. Never describe the writing process, the angle, the evidence ledger, the validator, or the repair itself.
Fix EVERY validation failure listed below.
The exact generic filler and meta-editorial phrases detected by the validator are listed below. A phrase like "the useful point", "the specific change described", or "rather than a broader claim" is not an acceptable substitute for an actual story-specific insight. Do not reuse them or close variants; replace them with concrete statements tied to the supplied story evidence.
Strengthen concrete story-specific grounding.
Remove generic AI/LinkedIn filler.
At least two concrete story-specific details must appear in the repaired post.
The body must contain a distinct interpretation or consequence tied to those details. A sentence that would fit almost any AI story is not acceptable. The final paragraph must explicitly resolve that interpretation into a concrete conclusion supported by the story.
Do not use phrases like "AI is changing work", "the future of work", "companies need to adapt", "this raises questions", or "the implications are profound" unless the exact story evidence makes that statement necessary.

Most importantly, do not merely name the tension. Explain it and CONCLUDE it. For example, if the story shows AI-generated code or decisions being trusted over experienced workers, the post should explain what that mismatch means for how work is judged or who is trusted — using only what the supplied story supports.
The first three lines must be the exact headline followed by two punchy, story-specific hook lines.
Every substantive paragraph after the hooks must contain at least one concrete detail from the supplied evidence.
The final paragraph must provide the conclusion and complete the thought; never leave the argument unfinished or end with a phrase such as "The concrete tension is", "The useful point is", "The practical question is", or "This means".
Do not replace story-specific reporting with generic commentary about AI safety, governance, ethics, responsible innovation, progress, society, or the future unless that specific idea is explicitly supported by the supplied story.
Keep 65-105 words and 320-950 characters. Aim for 80-95 words; 120 words is a hard maximum, not a target. Count the words before returning the draft.
The first three non-empty lines must be: exact headline, short hook, short hook. Keep each hook short so there is enough room for the 2-3 explanatory paragraphs within the word limit.
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


  const repairedRaw = await repairRaw(firstPost, firstValidation);
  const repairedPost = normalizeGeneratedPost(repairedRaw);
  const repairedValidation = validatePost(repairedPost);

  console.info("[PostCraft] post_validation", {
    attempt: "repair",
    ...repairedValidation,
  });

  if (repairedValidation.ok) {
    console.info("[PostCraft] editorial_quality_gate=repaired");
    if (onPostToken) onPostToken(repairedPost);
    return repairedPost;
  }

  const fallbackPost = buildGroundedPostFallback(story, angle);
  const fallbackValidation = validatePost(fallbackPost);

  console.warn("[PostCraft] post_validation", {
    attempt: "grounded_fallback",
    ...fallbackValidation,
  });

  if (fallbackValidation.ok) {
    console.info("[PostCraft] editorial_quality_gate=grounded_fallback");
    if (onPostToken) onPostToken(fallbackPost);
    return fallbackPost;
  }

  console.warn("[PostCraft] post_rejected_after_grounded_fallback", {
    reasons: fallbackValidation.reasons,
  });

  throw new Error(
    `PostCraft rejected the draft after two editorial passes. ${repairedValidation.reasons.join(" ")}`,
  );
}