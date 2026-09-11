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
        typeof v.evidence === "string"
          ? v.evidence.trim()
          : "Based on the selected story and its supplied summary.";

      return angle && why
        ? { angle, why, evidence }
        : null;
    })
    .filter((x): x is Angle => Boolean(x))
    .slice(0, 3);
}

function isForbiddenAngle(angle: Angle) {
  const text = `${angle.angle} ${angle.why}`.toLowerCase();

  return [
    "raises questions",
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
  ].some((phrase) => text.includes(phrase));
}

function selectSafeAngles(angles: Angle[]) {
  const unique = new Map<string, Angle>();

  for (const angle of angles) {
    if (isForbiddenAngle(angle)) continue;

    const key = angle.angle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

    if (!key || unique.has(key)) continue;
    unique.set(key, angle);
  }

  return Array.from(unique.values()).slice(0, 3);
}

async function buildEditorialPass(story: Story) {
  const prompt = `You are PostCraft AI, an editorial thinking partner. Generate the strongest useful response from the selected story below.

Do not search the internet. Do not fetch another article. Work only from the story information provided here.

SELECTED STORY
Topic: ${story.topic}
Headline: ${story.headline}
Source: ${story.source}
Summary: ${story.summary}

Find the most interesting thing to say about THIS story. Do not merely summarize the headline. Look for a specific tension, contrast, implication, surprising relationship, affected group, trade-off, mechanism, or unresolved question contained in the story information.

Return up to 3 genuinely different angles. They do not need to be three if the story only supports one or two strong ideas. Never invent statistics, quotes, examples, events, or facts that are not in the supplied story. Do not use generic angles such as "technology is changing work", "people need to adapt", "AI will improve efficiency", "AI may increase inequality", "this raises questions", "future of work", or "responsible innovation".

The evidence field should explain which part of the supplied story led you to the angle. It may paraphrase the supplied summary. Be honest when the story information is limited.

Return ONLY valid JSON. Do not use Markdown fences or explanatory text.

The response must use exactly this structure:
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
      "why": "why this is interesting",
      "evidence": "the story detail that supports this angle"
    }
  ]
}`;

  const parsed = parseJson(
    await provider().generateText(prompt, {
      format: "json",
      temperature: 0.2,
      numPredict: 500,
    })
  );

  return {
    evidence: parseEvidence(parsed?.evidence),
    angles: selectSafeAngles(parseAngles(parsed?.angles)),
  };
}

export async function generateEditorialAngles(story: Story) {
  const startedAt = Date.now();
  const editorial = await buildEditorialPass(story);

  console.info(
    `[PostCraft] editorial_ms=${Date.now() - startedAt} model_only=true evidence=${editorial.evidence.length} angles=${editorial.angles.length}`
  );

  if (!editorial.angles.length) {
    throw new Error("PostCraft could not find a useful angle in this story. Try another story.");
  }

  return {
    angles: editorial.angles,
    evidence: editorial.evidence,
  };
}

function validateEvidence(value: unknown): Evidence[] {
  return parseEvidence(value);
}

function postHasConcreteAnchor(post: string) {
  const words = post.trim().split(/\s+/);

  const topicPattern =
    /\b(ai|artificial intelligence|missile|guidance|targeting|autonomous|autonomy|non-state|military|weapon|weapons|technology|proliferation|model|research|evidence|scenario|jobs|workers|wages|unemployment|entry-level)\b/i;

  return words.length >= 70 && topicPattern.test(post);
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
  let evidence = validateEvidence(suppliedEvidence);

  if (evidence.length < 1) {
    evidence = (await buildEditorialPass(story)).evidence;
  }

  const ledger = evidence.length
    ? evidence
        .map((e, i) => `${i}. ${e.claim} [${e.type}] — ${e.support}`)
        .join("\n")
    : "No separate evidence ledger was available. Use only the headline and summary below.";

  const prompt = `You are PostCraft AI's final LinkedIn editor. Write the post directly from the selected story and the user's chosen angle.

Do not search the internet. Do not add outside facts. Do not invent statistics, examples, quotes, or context. If the supplied story information is limited, make the argument from what is actually there rather than pretending you know more.

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

Write a natural LinkedIn post of roughly 110-160 words in 4-6 short paragraphs. Start with the insight, not "AI is changing..." or a generic introduction. Make the relationship between the story and the user's take clear. Preserve uncertainty where the story is uncertain. Avoid corporate jargon and generic motivational language.

End with ONE specific discussion question only if the story and the user's take contain a genuine tension, trade-off, disagreement, or unresolved issue worth discussing. Never use generic questions such as "What do you think?", "Agree or disagree?", or "Thoughts?".

Return ONLY JSON: {"post":"the finished LinkedIn post"}`;

  const result = parseJson(
    await provider().generateText(prompt, {
      format: "json",
      temperature: 0.3,
      numPredict: 260,
    })
  );

  const post = typeof result?.post === "string" ? result.post.trim() : "";

  if (!post) {
    throw new Error("PostCraft could not produce a post from the selected angle.");
  }

  if (!postHasConcreteAnchor(post) || postHasGenericFiller(post)) {
    throw new Error("PostCraft generated a draft that was too generic. Try another angle or regenerate.");
  }

  return post;
}

