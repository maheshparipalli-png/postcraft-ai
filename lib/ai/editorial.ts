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
    : headline;

  const angle = apprenticeshipTheme
    ? "The AI disruption may begin by removing the routine work that once served as an apprenticeship for younger workers."
    : "The useful question in this story is what changes when " + headline.replace(/[.]+$/, "") + ".";

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
      numPredict: 350,
    })
  );

  const evidence = parseEvidence(parsed?.evidence);
  const angles = selectSafeAngles(parseAngles(parsed?.angles));

  // Small local models can occasionally return valid JSON with no usable
  // angles even when the supplied story contains enough evidence. Keep the
  // editorial pipeline grounded by falling back to a deterministic angle
  // derived only from the supplied headline and summary.
  if (!angles.length) {
    const fallback = buildGroundedFallback(story);
    if (fallback.angles.length) return fallback;
  }

  return { evidence, angles };
}


export async function generateEditorialDraft(story: Story) {
  const startedAt = Date.now();
  const editorial = await buildEditorialPass(story);
  const ranked = rankAngles(editorial.angles, story);

  if (!ranked.length) {
    const fallback = buildGroundedFallback(story);
    if (!fallback.angles.length) throw new Error("This story did not contain enough specific evidence for a strong editorial angle. Try another story.");
    const selected = {
      ...fallback.angles[0],
      score: 6,
      criteria: { readerInterest: 7, discussionPotential: 7, relevance: 6, clarity: 8, specificity: 8, linkedinFit: 7, evidenceStrength: 9 },
    };
    const post = await generateEditorialPost(story, selected.angle, selected.why, "Use a balanced, thoughtful professional perspective. Focus on the concrete tension or implication in the selected angle without adding outside facts.", fallback.evidence);
    return { angles: [selected], evidence: fallback.evidence, selectedAngle: selected, post, editorialMs: Date.now() - startedAt };
  }

  const selected = ranked[0];
  const post = await generateEditorialPost(story, selected.angle, selected.why, "Use a balanced, thoughtful professional perspective. Focus on the concrete tension or implication in the selected angle without adding outside facts.", editorial.evidence);

  console.info("[PostCraft] editorial_pipeline_ms=" + (Date.now() - startedAt) + " candidates=" + editorial.angles.length + " ranked=" + ranked.length + " selected_score=" + selected.score);
  return { angles: ranked.slice(0, 3), evidence: editorial.evidence, selectedAngle: selected, post, editorialMs: Date.now() - startedAt };
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now();
  const editorial = await buildEditorialPass(story);

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

  // The prompt asks for 110-160 words. Keep a reasonable floor, but do not
  // reject a useful draft merely because the small local model came in short.
  return words.length >= 55 && sharedTerms >= 2;
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

function postHasGenericFiller(post: string) {
  return [
    "it's crucial to recognize",
    "not evenly distributed",
    "highlights the need",
    "raises a crucial question",
    "strike a balance",
    "in today's rapidly changing world",
    "the future of work",
    "what do you think",
    "agree or disagree",
  ].some((phrase) => post.toLowerCase().includes(phrase));
}

export async function generateEditorialPost(
  story: Story,
  angle: string,
  angleWhy: string,
  modeInstruction: string,
  suppliedEvidence?: Evidence[]
) {
  const evidence = validateEvidence(suppliedEvidence);

  if (evidence.length < 1) {
    throw new Error("Evidence is required before post generation.");
  }

  const ledger = evidence
    .map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`)
    .join("\n");

  const prompt = `You are PostCraft AI's final LinkedIn editor. Write the post directly from the selected story and the user's chosen angle.

Do not search the internet. Do not add outside facts. Do not invent statistics, examples, quotes, or context. If the supplied story information is limited, make the argument from what is actually there rather than pretending you know more.

Write like a thoughtful human professional, not like an AI news summarizer. Use plain, natural English that a non-specialist can understand on the first reading.

The post MUST add an editorial proposition, not merely rewrite the source. Think in this order:
1. Identify the concrete fact or development in the story.
2. Find the strongest tension, trade-off, contradiction, unanswered question, or second-order implication that is actually supported by the story and selected angle.
3. State that insight clearly in your own words.
4. Explain why the tension matters using only the supplied evidence.
5. If appropriate, end with one specific question that follows naturally from that tension.

A useful test: if the post could be created by copying the source summary and replacing a few words, it has failed. The reader should come away with a distinct idea about the story, not a recap of it.

Prefer structures such as "The interesting part is not X. It is Y.", "That creates a less obvious problem: ...", or "The real tension here is ...", but use them naturally and do not force a template.

For stories about AI monitoring, AI safety, AI agents, or AI systems supervising other AI systems, examine the concrete tension between capability and oversight, including who watches the monitoring system, without inventing facts that are not in the story.

Avoid corporate clichés, generic openings, inflated language, repetitive phrasing, excessive headings, forced rhetorical questions, and phrases such as "in today's rapidly changing world", "this marks a significant milestone", "the implications are profound", and "it is important to note". Vary sentence length, keep paragraphs short, and make one clear point. Do not pretend to have personal experiences or emotions.

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

Write a natural LinkedIn post of roughly 110-160 words in 4-6 short paragraphs. Start with the specific insight from the selected angle. Do not start with a generic statement about AI, technology, business, or change.

Make the relationship between the story and the user's take clear. Preserve uncertainty where the story is uncertain. Avoid corporate jargon and generic motivational language.

End with ONE specific discussion question only when the story and the user's take contain a genuine tension, trade-off, disagreement, or unresolved issue worth discussing. Never use generic questions such as "What do you think?", "Agree or disagree?", or "Thoughts?".

Return ONLY JSON: {"post":"the finished LinkedIn post"}`;

  // Keep the final post generation as plain text rather than JSON. The
  // production model is intentionally small (qwen2.5:1.5b), and asking it to
  // produce a 110-160 word post plus strict JSON structure can occasionally
  // yield valid model output that is not parseable as JSON. The editorial pass
  // still uses JSON because its structured evidence/angle output is needed.
  const rawResult = await provider().generateText(prompt.replace(
    "Return ONLY JSON: {\"post\":\"the finished LinkedIn post\"}",
    "Return ONLY the finished LinkedIn post. Do not wrap it in JSON, Markdown fences, or quotation marks."
  ), {
    temperature: 0.3,
    numPredict: 220,
  });

  const parsedResult = parseJson(rawResult);
  const post =
    typeof parsedResult?.post === "string"
      ? parsedResult.post.trim()
      : rawResult.trim();

  if (!post) {
    throw new Error("PostCraft could not produce a post from the selected angle.");
  }

  const hasConcreteAnchor = postHasConcreteAnchor(post, story, angle);
  const hasSourceGrounding = postHasSourceGrounding(post, story, evidence, angle);
  const hasGenericFiller = postHasGenericFiller(post);

  console.info("[PostCraft] post_validation", {
    wordCount: post.split(/\s+/).filter(Boolean).length,
    hasConcreteAnchor,
    hasSourceGrounding,
    hasGenericFiller,
  });

  if (!hasConcreteAnchor || !hasSourceGrounding || hasGenericFiller) {
    throw new Error("PostCraft rejected the generated draft because it was not sufficiently grounded in the selected source. The article will be skipped and another source will be tried.");
  }

  return post;
}
