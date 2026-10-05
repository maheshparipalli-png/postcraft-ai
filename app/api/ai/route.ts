import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { Evidence, generateEditorialAngles, generateEditorialDraft, generateEditorialPost } from "@/lib/ai/editorial";
import { getBillingAccess } from "@/lib/billing/access";
import { normalizeStatisticContent } from "@/lib/postcard/content";
import { parseJsonObject } from "@/lib/ai/json";
import { judgeQuoteLinkedinQuality } from "@/lib/postcard/quality";
import { httpStatusForAIError, userFacingAIError } from "@/lib/ai/errors";

// AI generation can legitimately take longer than a normal API request because
// the self-hosted Ollama model may need to load before producing tokens.
export const maxDuration = 300;

function isPostCraftAnglePrompt(prompt: string) {
  return prompt.includes("You are PostCraft AI, an editorial thinking partner.") &&
    prompt.includes("Analyze this exact news story") &&
    prompt.includes("Return ONLY valid JSON");
}

function isPostCraftPostPrompt(prompt: string) {
  return prompt.includes("Turn ONE news development and ONE selected angle into a LinkedIn post") &&
    prompt.includes("Selected angle:");
}

function extractField(prompt: string, field: string) {
  const match = prompt.match(new RegExp(`^${field}: (.*)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function extractMode(prompt: string) {
  if (prompt.includes("Make the thesis more pointed")) return "Make the thesis more pointed. Cut safe filler and state the implication clearly. The reader should have a reason to agree or disagree.";
  if (prompt.includes("smart person wrote it for another smart person")) return "Make it sound like a smart person wrote it for another smart person. Use plain language and natural sentence rhythm.";
  if (prompt.includes("Take a genuinely different route")) return "Take a genuinely different reasoning route into the same thesis. Change the opening and reasoning structure, not just the wording.";
  return "Write the strongest natural version of the selected thesis.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const action = typeof body?.action === "string" ? body.action : "";

    if (!prompt && action !== "postcard" && action !== "quoteStory") return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    if (prompt.length > 12000) return NextResponse.json({ error: "prompt is too long" }, { status: 400 });

    if (action === "postcard") {
      const startedAt = Date.now();
      const template = typeof body?.template === "string" ? body.template : "editorial";
      const idea = typeof body?.idea === "string" ? body.idea.trim() : "";
      const category = typeof body?.category === "string" ? body.category.trim() : "general motivation";
      const variationSeed = typeof body?.variationSeed === "string" ? body.variationSeed.trim() : "";
      const previousHeadline = typeof body?.previousHeadline === "string" ? body.previousHeadline.trim() : "";
      const previousBody = typeof body?.previousBody === "string" ? body.previousBody.trim() : "";
      const previousClosing = typeof body?.previousClosing === "string" ? body.previousClosing.trim() : "";
      const currentStat = typeof body?.stat === "string" ? body.stat.trim() : "";

      const formatInstructions = ({
        success: "Create a compact, uplifting success or comeback story. Use a relatable human situation, a setback or obstacle, a turning point, and a hopeful lesson. It may be fictional or inspired; do not present fiction as verified fact.",
        person: "Create an inspiring person-centered story. Focus on one human quality, challenge, choice, or contribution and the feeling it leaves with the reader. It may be a broadly inspired story rather than a factual biography.",
        history: "Create a warm story inspired by a historical moment or human experience. Focus on the human meaning rather than fact-heavy detail. It may be simplified or illustrative and does not need fact verification.",
        thought: "Create a gentle thought experiment with a surprising but useful question, a simple setup, and a hopeful reflection. Keep it clearly hypothetical.",
        mindful: "Create a small, practical moment of attention, movement, pause, or observation that feels calming and encouraging. Avoid medical claims.",
      } as Record<string, string>)[template] || "Create one practical, feel-good motivational idea.";

      const basePrompt = `You are PostCraft's human-sounding story writer.

Create a FRESH idea for the selected format. Every Generate click must feel genuinely different from the previous card.

The goal is not factual reporting. Fictional, imagined, metaphorical, or loosely inspired stories are allowed. Do not waste words qualifying them as facts. What matters is that the story feels warm, human, easy to understand, and leaves the reader with a good feeling or useful thought.

FORMAT: ${template}
EDITORIAL DIRECTION: ${category}
VARIATION SEED: ${variationSeed}

${formatInstructions}

The previous card was:
Headline: ${previousHeadline || "(none)"}
Body: ${previousBody || "(none)"}
Closing: ${previousClosing || "(none)"}

Do NOT reuse the previous card's topic, metaphor, message, structure, or wording. Start with a different underlying idea.

Create TWO related but deliberately different outputs:
1. POSTCARD: short visual copy. It should work on an image without becoming a full article.
2. LINKEDIN POST: the fuller human story. It should add context, emotion, and a natural takeaway.

The postcard and LinkedIn post must share the same core idea, but the postcard must NOT copy, quote, or closely paraphrase the LinkedIn post.

POSTCARD:
- headline: 4-10 words, clear, memorable, human
- body: 35-80 words, 2-4 short sentences
- closing: 6-18 words, memorable and simple

LINKEDIN POST:
- 80-180 words
- natural paragraphs with breathing room
- a human hook, a simple story or observation, and a warm takeaway
- use everyday English
- prefer short sentences
- make the reader feel something
- do not sound like an advertisement, essay, or AI response

STYLE:
- simple enough to understand on the first read
- warm, conversational, concrete, and human
- avoid corporate clichés, jargon, generic motivational filler, hashtags, emoji spam, and excessive punctuation
- never say "As an AI", "Here's a post", "I hope this helps", "Let me know", or similar meta-language
- do not use garbled or unusual control characters
- do not repeat sentences or the same idea unnecessarily
- do not make the postcard a shortened copy of the LinkedIn post

USER IDEA:
${idea || "(No separate idea provided.)"}

Return ONLY valid JSON:
{
  "headline": "postcard headline",
  "body": "short postcard body",
  "closing": "short postcard takeaway",
  "linkedinPost": "full human LinkedIn post"
}`;

      const provider = await getAIProvider();
      let best: { candidate: { headline: string; body: string; closing: string; linkedinPost: string }; quality: Awaited<ReturnType<typeof import("@/lib/postcard/quality").judgePostcardQuality>> } | null = null;
      const maxAttempts = 3;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const prompt = attempt === 0
          ? basePrompt
          : `${basePrompt}

QUALITY RETRY ${attempt}: The previous draft failed the quality gate. Produce a completely fresh version. Pay particular attention to human voice, simple language, emotional warmth, no repetition, and making the postcard clearly different from the LinkedIn post.`;

        const raw = await provider.generateText(prompt, {
          temperature: attempt === 0 ? 0.78 : 0.88,
          numPredict: 900,
          format: "json",
        });
        const generated = parseJsonObject(raw, "PostCard AI");

        const candidate = {
          headline: typeof generated.headline === "string" ? generated.headline.trim() : "",
          body: typeof generated.body === "string" ? generated.body.trim() : "",
          closing: typeof generated.closing === "string" ? generated.closing.trim() : "",
          linkedinPost: typeof generated.linkedinPost === "string" ? generated.linkedinPost.trim() : "",
        };

        const { judgePostcardQuality } = await import("@/lib/postcard/quality");
        const quality = await judgePostcardQuality(candidate);
        if (!best || quality.score > best.quality.score) best = { candidate, quality };

        console.info("[PostCraft] postcard_quality", {
          attempt: attempt + 1,
          score: quality.score,
          pass: quality.pass,
          reasons: quality.reasons,
        });

        if (quality.pass) {
          best = { candidate, quality };
          break;
        }
      }

      if (!best) throw new Error("PostCard generation did not return usable content.");
      if (!best.quality.pass) {
        throw new Error("PostCard could not meet the human-writing quality bar after three attempts. Please try again.");
      }

      const statistic = normalizeStatisticContent(
        currentStat,
        "",
        "",
      );

      console.info("[PostCraft] postcard_generation_ms=" + (Date.now() - startedAt));
      return NextResponse.json({
        headline: best.candidate.headline,
        body: best.candidate.body,
        closing: best.candidate.closing,
        linkedinPost: best.candidate.linkedinPost,
        stat: statistic.stat,
        statLabel: statistic.statLabel,
        qualityScore: best.quality.score,
      });
    }

    if (action === "quoteStory") {
      const quote = typeof body?.quote === "string" ? body.quote.trim() : "";
      const author = typeof body?.author === "string" ? body.author.trim() : "";
      const category = typeof body?.category === "string" ? body.category.trim() : "motivation";

      if (!quote) {
        return NextResponse.json({ error: "quote is required" }, { status: 400 });
      }

      const basePrompt = `You are PostCraft's LinkedIn story writer.

Turn the motivational quote below into a smart, emotionally engaging LinkedIn text post.

QUOTE: ${quote}
QUOTE AUTHOR: ${author || "(unknown)"}
THEME: ${category}

IMPORTANT:
- The quote is the starting idea, not the whole post.
- Build a small, memorable human story around the idea in the quote.
- The story may be fictional, imagined, metaphorical, or loosely inspired. Do NOT present an invented story as a real event.
- Do NOT invent a biography, achievement, job, company, date, statistic, or quote-author experience.
- Do not claim the quote author said anything beyond the supplied quote.
- The story should feel like something a thoughtful person might share after noticing a moment in everyday life.
- Use one concrete scene or situation, a small tension or turning point, then connect it naturally to the quote's deeper meaning.
- Do not simply explain the quote.
- Do not start with "This quote reminds me..." or "Here is a story..."
- Do not mention AI, PostCraft, prompts, generation, or writing.
- Do not use hashtags or emoji.
- Keep the language simple, warm, conversational, and specific.
- Use short paragraphs with breathing room.
- End with a quiet takeaway or reflective question, not a sales pitch.
- Target 130-220 words.

Return ONLY valid JSON:
{
  "linkedinPost": "the complete LinkedIn text post"
}`;

      let bestPost = "";
      let bestScore = -1;
      let bestReasons: string[] = [];
      // Keep the strict independent quality gate, but cap the route at two
      // candidate passes so one click cannot consume six long LLM calls.
      const maxAttempts = 2;
      const provider = await getAIProvider();

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const prompt = attempt === 0
          ? basePrompt
          : `${basePrompt}

QUALITY RETRY ${attempt}: The previous draft failed one or more mandatory quality parameters.

FAILED PARAMETERS:
${bestReasons.join(", ") || "unknown"}

PREVIOUS DRAFT:
${bestPost}

Regenerate from a genuinely different angle. Fix every failed parameter. Keep the story concrete, human, simple, emotionally natural, and tightly connected to the quote without merely explaining it.`;

        const raw = await provider.generateText(prompt, {
          temperature: attempt === 0 ? 0.78 : 0.88,
          // The post is only 130-220 words; avoid letting the model spend
          // hundreds of extra tokens before the independent judge runs.
          numPredict: 500,
          format: "json",
        });
        const generated = parseJsonObject(raw, "Quote LinkedIn story");
        const candidate = typeof generated.linkedinPost === "string" ? generated.linkedinPost.trim() : "";
        const quality = await judgeQuoteLinkedinQuality(candidate, quote, author);

        console.info("[PostCraft] quote_linkedin_quality", {
          attempt: attempt + 1,
          score: quality.score,
          pass: quality.pass,
          reasons: quality.reasons,
        });

        if (quality.score > bestScore) {
          bestScore = quality.score;
          bestPost = candidate;
          bestReasons = quality.reasons;
        }

        if (quality.pass) {
          return NextResponse.json({
            linkedinPost: candidate,
            qualityScore: quality.score,
            qualityReasons: [],
          });
        }
      }

      throw new Error(
        `Could not create a LinkedIn story that passes all quality parameters after ${maxAttempts} attempts. Failed checks: ${bestReasons.join(", ")}.`,
      );
    }

    const editorialRequest = action === "editorial";

    if (editorialRequest) {
      const startedAt = Date.now();
      const story = {
        topic: extractField(prompt, "Topic"),
        headline: extractField(prompt, "Headline") || extractField(prompt, "News title"),
        source: extractField(prompt, "Source") || extractField(prompt, "News source"),
        summary: extractField(prompt, "Summary"),
        url: extractField(prompt, "URL"),
      };
      const result = await generateEditorialDraft(story);
      console.info("[PostCraft] editorial_request_ms=" + (Date.now() - startedAt));
      return NextResponse.json(result);
    }

    const angleRequest = action === "angles" || (!action && isPostCraftAnglePrompt(prompt));
    const postRequest = action === "post" || (!action && isPostCraftPostPrompt(prompt));

    if (angleRequest) {
      const startedAt = Date.now();
      const story = {
        topic: extractField(prompt, "Topic"),
        headline: extractField(prompt, "Headline") || extractField(prompt, "News title"),
        source: extractField(prompt, "Source") || extractField(prompt, "News source"),
        summary: extractField(prompt, "Summary"),
        url: extractField(prompt, "URL"),
      };
      const result = await generateEditorialAngles(story);
      console.info(`[PostCraft] angle_route_ms=${Date.now() - startedAt} returned=${result.angles.length}`);
      return NextResponse.json({ text: JSON.stringify(result.angles), evidence: result.evidence });
    }

    if (postRequest) {
      const story = {
        topic: extractField(prompt, "Topic"),
        headline: extractField(prompt, "Headline") || extractField(prompt, "News title"),
        source: extractField(prompt, "Source") || extractField(prompt, "News source"),
        summary: extractField(prompt, "Summary"),
        url: extractField(prompt, "URL"),
      };
      let suppliedEvidence: Evidence[] | undefined;
      const evidenceJson = extractField(prompt, "Evidence JSON");
      if (evidenceJson) {
        try {
          const parsed = JSON.parse(evidenceJson);
          if (Array.isArray(parsed)) suppliedEvidence = parsed as Evidence[];
        } catch { suppliedEvidence = undefined; }
      }
      const text = await generateEditorialPost(
        story,
        extractField(prompt, "Selected angle"),
        extractField(prompt, "Why this angle works"),
        extractMode(prompt),
        suppliedEvidence
      );
      return NextResponse.json({ text });
    }

    const provider = await getAIProvider();
    const text = await provider.generateText(prompt);
    return NextResponse.json({ text });
  } catch (error) {
    console.error("[PostCraft] AI request failed", {
      kind: error && typeof error === "object" && "kind" in error ? String((error as { kind?: unknown }).kind) : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: userFacingAIError(error) },
      { status: httpStatusForAIError(error) },
    );
  }
}
