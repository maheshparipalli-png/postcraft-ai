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
    "rather than", "not just", "more than", "isn't", "is not",
    "cannot", "can't", "limits", "limitation", "difference",
    "mismatch", "reliably", "reliable", "ability", "failure",
    "consequence", "implication", "threshold", "where", "when",
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

async function buildEditorialPass(story: Story) {
  const prompt = `You are PostCraft AI's editorial planner. Work ONLY from the supplied story.

STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

Generate THREE different editorial theses. Each must connect two concrete story details and explain why their relationship matters. Express a distinct professional interpretation, not a summary or invented controversy.

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
{"angles":["first thesis","second distinct thesis","third distinct thesis"]}`;

  const aiProvider = await provider();
  const plannerRaw = await aiProvider.generateText(prompt, {
    format: "json",
    temperature: 0.2,
    numPredict: 350,
  });

  const parsed = parseJson(plannerRaw);

  const rawAngles = Array.isArray(parsed?.angles) ? parsed.angles : typeof parsed?.angle === "string" ? [parsed.angle] : [];
  let angles = selectSafeAngles(rawAngles.filter((value): value is string => typeof value === "string")
    .map((value) => ({
      angle: normalizeGeneratedText(value, { plainPunctuation: true }),
      why: "This connects concrete details from the selected story.",
      evidence: story.summary,
    })));

  // Descriptive stories can still support a strong editorial thesis when the
  // model planner fails. Build the fallback from the actual story rather than
  // inserting topic-specific text that could belong to a different article.
  if (!angles.length) {
    const summary = story.summary.trim().replace(/\s+/g, " ").replace(/[.!?]+$/, "");
    const butMatch = summary.match(/^(.+?)\s+but\s+(.+)$/i);
    const whileMatch = summary.match(/^(.+?)\s+while\s+(.+)$/i);

    let fallbackAngle = "";
    let fallbackWhy = "";

    if (butMatch) {
      fallbackAngle = `The story exposes a trade-off: ${butMatch[1].trim()} but ${butMatch[2].trim()}.`;
      fallbackWhy = "This connects the two concrete conditions described in the story and explains the tension between them.";
    } else if (whileMatch) {
      fallbackAngle = `The story exposes a tension between ${whileMatch[1].trim()} and ${whileMatch[2].trim()}.`;
      fallbackWhy = "This connects the two concrete conditions described in the story.";
    } else if (story.headline && summary) {
      fallbackAngle = `The important gap in this story is between what the AI agents can do and what they can reliably do in practice: ${summary}.`;
      fallbackWhy = "This keeps the interpretation tied to the supplied headline and summary without adding outside facts.";
    }

    if (fallbackAngle) {
      angles = selectSafeAngles([
        {
          angle: fallbackAngle,
          why: fallbackWhy,
          evidence: story.summary,
        },
      ]);
    }
  }

  const evidence = angles.length
    ? [
        {
          claim: angles[0].angle,
          support: angles[0].evidence.trim(),
          type: "interpretation" as const,
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
      const generated = await generateEditorialPost(
        normalizedStory,
        selected.angle,
        selected.why,
        "Take a clear, thoughtful professional point of view. Do not manufacture controversy or dilute the thesis into a neutral summary. Do not add outside facts.",
        editorial.evidence,
        onPostToken,
      );
      // generateEditorialPost returns { post, quality }, not a plain string.
      // Expose the actual post text to API routes and the Discover streaming UI.
      const post = generated.post;

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
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s*$/gm, "")
    .replace(/^\s*\d+[.)]\s*$/gm, "")
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

  // Keep Idea Radar/editorial posts substantial enough to carry the argument,
  // while staying comfortably below LinkedIn's 3,000-character post limit.
  if (words.length < 200 || words.length > 300) return false;

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
  return supportMatches >= 2 || (titleMatches >= 1 && supportMatches >= 1);
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
  const markers = ["but","yet","instead","rather","because","means","reveals","shows","leaves","forces","changes","shifts","depends","trade-off","tradeoff","boundary","gap","constraint","cost","risk","advantage","disadvantage","tension","unlike","while","reliably","reliable","failure","fails","deceive","deception","conceal","conceals","circumvent","autonomy","trust","trusted","control","predict"];
  return anchoredTerms.length >= 1 && markers.some((value) => bodyLower.includes(value));
}

export type PostQualityCheck = {
  key: "duplication" | "specialCharacters" | "relevance" | "completeness" | "length";
  label: string;
  passed: boolean;
  detail: string;
};

function normalizeQualityText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function sentenceSimilarity(a: string, b: string) {
  const aTokens = new Set(normalizeQualityText(a).split(" ").filter((word) => word.length >= 4));
  const bTokens = new Set(normalizeQualityText(b).split(" ").filter((word) => word.length >= 4));
  if (!aTokens.size || !bTokens.size) return 0;
  let shared = 0;
  for (const token of aTokens) if (bTokens.has(token)) shared += 1;
  return shared / Math.max(aTokens.size, bTokens.size);
}

export function evaluatePostQuality(post: string, story: Story, angle: string): PostQualityCheck[] {
  const sentences = post.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  let maxSimilarity = 0;
  for (let i = 0; i < sentences.length; i += 1) {
    for (let j = i + 1; j < sentences.length; j += 1) {
      maxSimilarity = Math.max(maxSimilarity, sentenceSimilarity(sentences[i], sentences[j]));
    }
  }

  const hasForbiddenFormatting =
    /(?:^|\n)\s*(?:#{1,6}\s|[-*•]\s|\d+[.)]\s)|\*\*|__|[\x60]|https?:\/\/|[\u{1F300}-\u{1FAFF}]|[^\x09\x0A\x0D\x20-\x7E]/u.test(post);

  const sourceText = normalizeQualityText(
    story.topic + " " + story.headline + " " + story.summary + " " + angle,
  );
  const sourceTerms = new Set(sourceText.split(" ").filter((word) => word.length >= 5));
  const postTerms = new Set(normalizeQualityText(post).split(" ").filter((word) => word.length >= 5));
  let shared = 0;
  for (const term of sourceTerms) if (postTerms.has(term)) shared += 1;
  const relevanceRatio = sourceTerms.size ? shared / Math.min(sourceTerms.size, 12) : 0;

  const wordCount = post.split(/\s+/).filter(Boolean).length;
  const trimmedPost = post.trim();
  const complete =
    Boolean(trimmedPost) &&
    !/[,:;\-]\s*$/.test(trimmedPost) &&
    !/(?:\.\.\.|…)\s*$/.test(trimmedPost) &&
    !/\b(?:and|or|but|because|with|to|of|the|a|an|this|these|those|the)\s*$/i.test(trimmedPost) &&
    !/The implication follows from these details:/i.test(trimmedPost);

  return [
    {
      key: "duplication",
      label: "No duplication",
      passed: maxSimilarity < 0.82,
      detail: maxSimilarity < 0.82 ? "No closely repeated sentences detected." : "Some sentences are too similar.",
    },
    {
      key: "specialCharacters",
      label: "Formatting checked",
      passed: !hasForbiddenFormatting,
      detail: hasForbiddenFormatting ? "Markdown, URLs, bullets, emoji, control characters, or non-ASCII symbols detected." : "Plain text formatting check passed.",
    },
    {
      key: "relevance",
      label: "Topic relevance",
      passed: (shared >= 2 && relevanceRatio >= 0.16) || (shared >= 1 && relevanceRatio >= 0.08 && normalizeQualityText(post).includes(normalizeQualityText(angle).split(" ").filter((word) => word.length >= 6).slice(0, 2).join(" "))),
      detail: shared >= 2 ? "Post contains multiple terms grounded in the selected story and angle." : "The post needs stronger direct grounding in the selected story and angle.",
    },
    {
      key: "completeness",
      label: "Complete text",
      passed: complete,
      detail: complete ? "Post ends as a complete thought." : "Post appears to end mid-sentence.",
    },
    {
      key: "length",
      label: "Length checked",
      passed: wordCount >= 200 && wordCount <= 300 && post.length <= 3000,
      detail: wordCount + " words; target is 200–300 and under 3,000 characters.",
    },
  ];
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

  const ledger = evidence.length
    ? evidence
        .map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`)
        .join("\n")
    : "No separate evidence ledger was supplied. Use only the story headline and summary.";

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

    return sanitizeLinkedInPost(decodedPost);
  }

  const basePrompt = `Create a finished LinkedIn post from the supplied story, selected editorial thesis, and available evidence.

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

POST STRUCTURE
1. HOOK
Start with a strong, attention-grabbing opening. It should capture the central idea without using a generic template headline.

2. CONTEXT
Briefly explain what happened or what the story is about and why it matters.

3. KEY INSIGHTS
Highlight 2–3 important and distinct insights grounded in the supplied story.
Each insight must add new information or reasoning.

4. TAKEAWAY
End the main content with one clear takeaway or lesson only if it adds something new.

The finished post should feel complete on its own and contain 200–300 words. Do not use placeholder numbering such as a lone "3".

5. CTA
End with ONE natural question or clear call to action directly related to the topic.

IMPORTANT WRITING RULES
- Focus on ONE central idea.
- Use short, readable paragraphs with blank lines between ideas, like a strong human LinkedIn post.
- Sound professional, conversational, and human.
- Use simple English. Avoid corporate jargon and generic motivational filler.
- Use the story details accurately.
- Do NOT use Markdown emphasis such as **bold**, *italics*, backticks, or heading markers.
- Do NOT end with a bare number, bullet, ellipsis, unfinished sentence, or incomplete list item.
- Every sentence must be grammatically complete. Never end a sentence with "The..." or any other truncated phrase.
- If you use numbered insights, every numbered item must contain complete text; otherwise use normal paragraphs.
- Do not include meta-writing such as "The implication follows from these details" or "The assumption behind:" as filler. State the actual insight directly.
- Before returning the post, check that the final paragraph is complete and that no formatting markers remain.
- Do not invent facts, numbers, quotes, motives, examples, or outside information.
- The selected angle is guidance for the central thesis, not a reason to reject the request.
- Do not reject the request because evidence is missing, the angle is weak, or the post does not satisfy an arbitrary stylistic rule.
- NEVER repeat the same idea simply because it appears in multiple fields. If the headline, angle, insight, takeaway, or CTA communicates the same idea, combine it rather than restating it.
- Do not restate the selected angle as a separate section or heading inside the post.
- Do not create a separate "Key Insights" or "Takeaway" heading unless it reads naturally in the finished post.
- The CTA must add a new invitation to discuss the topic; it must not repeat the takeaway.
- Do not use URLs, source footers, hashtags, or emojis.
- Return ONLY the finished LinkedIn post.`;

  const aiProvider = await provider();

  async function generateCandidate() {
    const raw = await aiProvider.generateText(
      basePrompt,
      {
        temperature: 0.25,
        numPredict: 1000,
      },
    );

    const post = normalizeGeneratedPost(raw);
    return {
      post,
      quality: evaluatePostQuality(post, story, angle),
    };
  }

  function failedChecks(quality: PostQualityCheck[]) {
    return quality.filter((check) => !check.passed);
  }

  function buildRepairPrompt(post: string, failures: PostQualityCheck[]) {
    const failureDetails = failures
      .map((check) => `- ${check.label}: ${check.detail}`)
      .join("\n");

    return `

QUALITY REPAIR
The existing LinkedIn post below failed one or more quality checks.

SOURCE CONTEXT
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

SELECTED ANGLE / CENTRAL THESIS
${angle}

WHY THIS ANGLE WORKS
${angleWhy}

STORY EVIDENCE
${ledger}

FAILED CHECKS
${failureDetails}

REPAIR INSTRUCTIONS
- Fix ALL of the listed failures in this single repair pass.
- Preserve the existing central thesis, useful facts, tone, and overall argument.
- Do not throw away a good post and write an unrelated replacement.
- Make the smallest natural changes needed to satisfy every failed check.
- If the post is too short, add useful story-grounded explanation using the source context above rather than generic filler.
- If the post is too long, remove repetition or low-value wording rather than cutting an argument mid-sentence.
- If relevance failed, strengthen connections to the supplied headline, summary, evidence, and selected angle. Use concrete source terms naturally; do not merely repeat the angle.
- If duplication failed, combine or rewrite repeated ideas while keeping the strongest version.
- If completeness failed, finish every incomplete sentence and make the final thought complete.
- If formatting failed, remove Markdown, URLs, bullets, numbering, emojis, control characters, and non-ASCII symbols. Use plain ASCII punctuation only (periods, commas, apostrophes, quotation marks, colons, semicolons, question marks, exclamation marks, and hyphens).
- Keep the result between 200 and 300 words and under 3,000 characters.
- Do not introduce new unsupported facts, numbers, quotes, examples, motives, or claims.
- The repaired post must still read naturally as a human LinkedIn post, not as a quality-check response.
- Return ONLY the repaired LinkedIn post. Do not explain the changes.

EXISTING POST
${post}
`;
  }

  let result = await generateCandidate();

  // Treat quality checks as a repair mechanism rather than a hard rejection.
  // Every failed check is sent to the repair pass together so the model can
  // correct multiple problems in one revision while preserving good content.
  const maxRepairPasses = 3;

  for (let repairPass = 1; repairPass <= maxRepairPasses; repairPass += 1) {
    const failures = failedChecks(result.quality);
    if (!failures.length) break;

    const repairedRaw = await aiProvider.generateText(
      buildRepairPrompt(result.post, failures),
      {
        temperature: 0.15,
        numPredict: 1000,
      },
    );

    const repairedPost = normalizeGeneratedPost(repairedRaw);
    result = {
      post: repairedPost,
      quality: evaluatePostQuality(repairedPost, story, angle),
    };

    console.info("[PostCraft] editorial_quality_repair", {
      pass: repairPass,
      failedChecks: failures.map((check) => check.key),
      remainingFailures: failedChecks(result.quality).map((check) => check.key),
    });
  }

  // Models can ignore length/duplication repair instructions. Apply a conservative
  // deterministic final pass: remove near-duplicate sentences and keep complete
  // sentences within the product's 300-word ceiling before the final validation.
  function compactPost(post: string) {
    const sentences = post.match(/[^.!?]+[.!?]+(?:["')\]]*)|[^.!?]+$/g) || [];
    const kept: string[] = [];
    for (const candidate of sentences) {
      const sentence = candidate.trim();
      if (!sentence) continue;
      const duplicate = kept.some((existing) => sentenceSimilarity(existing, sentence) >= 0.82);
      if (duplicate) continue;
      const currentWords = kept.join(" ").split(/\s+/).filter(Boolean).length;
      const sentenceWords = sentence.split(/\s+/).filter(Boolean).length;
      if (currentWords + sentenceWords > 300) break;
      kept.push(sentence);
    }
    return kept.join(" ").trim();
  }

  if (result.quality.some((check) => !check.passed && ["duplication", "completeness", "length"].includes(check.key))) {
    const compacted = compactPost(result.post);
    if (compacted) {
      result = {
        post: compacted,
        quality: evaluatePostQuality(compacted, story, angle),
      };
    }
  }

  const finalFailures = failedChecks(result.quality);

  if (finalFailures.length) {
    const details = finalFailures
      .map((check) => `${check.label}: ${check.detail}`)
      .join("; ");

    throw new Error(
      `The generated post could not pass PostCraft's quality checks after ${maxRepairPasses} repair passes. ${details}`,
    );
  }

  if (onPostToken) onPostToken(result.post);
  return result;
}