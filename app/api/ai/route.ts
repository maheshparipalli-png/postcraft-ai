import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { Evidence, generateEditorialAngles, generateEditorialDraft, generateEditorialPost } from "@/lib/ai/editorial";
import { getBillingAccess } from "@/lib/billing/access";

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
      const source = typeof body?.source === "string" ? body.source.trim() : "";

      const prompt = `You are PostCard, the human-sounding visual writing assistant inside PostCraft.

Create a FRESH motivational social-card idea. Every Generate click is a request for a genuinely different idea, not a rewrite of the previous card.

Today's editorial direction: ${category}
Variation seed: ${variationSeed}

The previous card was:
Headline: ${previousHeadline || "(none)"}
Body: ${previousBody || "(none)"}
Closing: ${previousClosing || "(none)"}

Do NOT reuse the previous card's topic, metaphor, message, structure, or wording. Do not simply replace a few words. Start with a different underlying idea.

Prefer concrete inspiration from the requested direction: a sporting comeback, business lesson, leadership moment, entrepreneurial struggle, mastery, resilience, achievement, or an everyday human observation. Do not claim that a real event, person, quote, statistic, or company did something unless it is supplied as source material. When no source is supplied, write an original motivational idea rather than inventing a real-world story.

Create short social-card copy that is easy to understand, specific, and human. It should sound like a thoughtful person sharing an observation, not a corporate marketing team and not an AI news summary.

Use the supplied idea and existing draft only when they contain useful source material. Do not invent facts, statistics, quotes, names, or claims.

For editorial or insight cards:
- headline: one clear main thought, 8-12 words and no more than about 70 characters
- body: 1-2 short sentences explaining what it means in plain English, no more than about 180 characters
- closing: one memorable human observation, 6-12 words and no more than about 80 characters

These are hard layout limits, not suggestions. Shorter is better. Never add extra explanation.
The body must answer "Why does this matter?" rather than repeat the headline. The closing should feel like a person's takeaway, not a generic motivational slogan.

For statistic cards:
- stat: preserve the supplied statistic exactly when present
- statLabel: one plain-English sentence explaining what the statistic means, no more than about 100 characters
- closing: one short human takeaway, no more than about 80 characters

Avoid corporate clichés, generic motivational language, hashtags, emojis, and phrases like "in today's rapidly changing world", "this highlights the importance", "game changer", "revolutionary", or "it is important to note".

Keep the language conversational. Prefer concrete words and short sentences. A little personality is good. Do not pretend to have personal experiences.

FORMAT: ${template}

USER IDEA:
${idea || "(No separate idea provided.)"}

CURRENT INPUT:
Main thought: ${currentHeadline || "(empty)"}
Supporting thought: ${currentBody || "(empty)"}
Closing line: ${currentClosing || "(empty)"}

SOURCE / FOOTER:
${source || "(none)"}

Return ONLY valid JSON with keys: headline, body, closing, stat, statLabel.`;

      const raw = await getAIProvider().generateText(prompt, {
        temperature: 0.72,
        numPredict: 220,
      });

      let generated: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") generated = parsed as Record<string, unknown>;
      } catch {
        throw new Error("PostCard AI returned an invalid response. Please try again.");
      }

      console.info("[PostCraft] postcard_generation_ms=" + (Date.now() - startedAt));
      return NextResponse.json({
        headline: typeof generated.headline === "string" ? generated.headline.trim() : "",
        body: typeof generated.body === "string" ? generated.body.trim() : "",
        closing: typeof generated.closing === "string" ? generated.closing.trim() : "",
        stat: typeof generated.stat === "string" ? generated.stat.trim() : "",
        statLabel: typeof generated.statLabel === "string" ? generated.statLabel.trim() : "",
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
