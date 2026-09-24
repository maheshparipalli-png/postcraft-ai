import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { Evidence, generateEditorialAngles, generateEditorialDraft, generateEditorialPost } from "@/lib/ai/editorial";
import { getBillingAccess } from "@/lib/billing/access";
import { normalizeStatisticContent } from "@/lib/postcard/content";

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
    const access = await getBillingAccess();
    if (!access.authenticated) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (!access.allowed) {
      return NextResponse.json(
        { error: access.status === "billing_unavailable" ? "Unable to verify billing access" : "Start your free trial or subscribe to continue", billingStatus: access.status },
        { status: access.status === "billing_unavailable" ? 500 : 402 },
      );
    }

    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
    const action = typeof body?.action === "string" ? body.action : "";

    if (!prompt && action !== "postcard") return NextResponse.json({ error: "prompt is required" }, { status: 400 });
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
      const currentHeadline = typeof body?.headline === "string" ? body.headline.trim() : "";
      const currentBody = typeof body?.supportingThought === "string" ? body.supportingThought.trim() : "";
      const currentClosing = typeof body?.closing === "string" ? body.closing.trim() : "";
      const currentStat = typeof body?.stat === "string" ? body.stat.trim() : "";
      const source = typeof body?.source === "string" ? body.source.trim() : "";

      const formatInstructions = ({
        success: `Create a compact success/comeback story. Use an identifiable human situation, a setback or obstacle, a turning point, and a useful lesson. Do not invent a named person or claim a real event unless source material is supplied.`,
        person: `Create a Person of the Day card. Choose a widely known inspiring person only when you can state broadly established facts. Do not invent dates, achievements, quotes, or personal details. Focus on one defining contribution and one practical lesson.`,
        history: `Create a Historical Moment card. Use a well-established historical event or moment and explain why it still matters. Do not invent dates, participants, quotations, or outcomes. If factual certainty is not possible, keep the wording general rather than making a specific claim.`,
        thought: `Create a Thought Experiment. Present a surprising hypothetical question, a short setup, and a useful reflection. It must be clearly hypothetical, not presented as a fact or prediction.`,
        mindful: `Create a Mindful Movement card. Give the reader one small physical or attention-based action they can do today, such as a slow walk, stretch, breath, pause, or deliberate observation. Keep it practical and non-medical.`,
      } as Record<string, string>)[template] || "Create one practical motivational idea.";

      const prompt = `You are PostCard, the human-sounding visual writing assistant inside PostCraft.

Create a FRESH social-card idea for the selected format. Every Generate click should be genuinely different from the previous card.

FORMAT: ${template}
EDITORIAL DIRECTION: ${category}
VARIATION SEED: ${variationSeed}

${formatInstructions}

The previous card was:
Headline: ${previousHeadline || "(none)"}
Body: ${previousBody || "(none)"}
Closing: ${previousClosing || "(none)"}

Do NOT reuse the previous card's topic, metaphor, message, structure, or wording. Start with a different underlying idea.

For the selected format:
- headline: 6-12 words, clear and specific
- body: 2-4 short sentences, roughly 80-150 words for story-based formats and 35-80 words for the other formats
- closing: one memorable takeaway, 8-18 words

For Person of the Day and Historical Moment, do not fabricate factual details. If source material is absent, prefer broadly established facts and avoid precise claims you cannot support.
For Thought Experiment, make the hypothetical nature unmistakable.
For Mindful Movement, avoid medical claims or promises.
For Success Story, do not present an invented story as a verified real event.

Avoid corporate clichés, generic motivational filler, hashtags, emojis, and phrases like "in today's rapidly changing world", "game changer", "revolutionary", or "it is important to note".

Keep the language conversational, concrete, and human. Do not pretend to have personal experiences.

USER IDEA:
${idea || "(No separate idea provided.)"}

Return ONLY valid JSON with keys: headline, body, closing.`;


      const raw = await getAIProvider().generateText(prompt, {
        temperature: 0.72,
        numPredict: 220,
        format: "json",
      });

      let generated: Record<string, unknown> = {};
      try {
        const cleaned = raw
          .replace(/^\s*\`\`\`(?:json)?\s*/i, "")
          .replace(/\s*\`\`\`\s*$/i, "")
          .trim();
        const parsed = JSON.parse(cleaned);
        if (parsed && typeof parsed === "object") generated = parsed as Record<string, unknown>;
      } catch {
        throw new Error("PostCard AI returned an invalid response. Please try again.");
      }

      const statistic = normalizeStatisticContent(
        currentStat,
        typeof generated.stat === "string" ? generated.stat : "",
        typeof generated.statLabel === "string" ? generated.statLabel : "",
      );

      console.info("[PostCraft] postcard_generation_ms=" + (Date.now() - startedAt));
      return NextResponse.json({
        headline: typeof generated.headline === "string" ? generated.headline.trim() : "",
        body: typeof generated.body === "string" ? generated.body.trim() : "",
        closing: typeof generated.closing === "string" ? generated.closing.trim() : "",
        stat: statistic.stat,
        statLabel: statistic.statLabel,
      });
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

    const text = await getAIProvider().generateText(prompt);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    const status = message.includes("Ollama request failed") || message.includes("Ollama returned")
      ? 502
      : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
