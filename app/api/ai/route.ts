import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { generateEditorialAngles, generateEditorialPost } from "@/lib/ai/editorial";

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

    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    if (prompt.length > 12000) return NextResponse.json({ error: "prompt is too long" }, { status: 400 });

    const angleRequest = action === "angles" || (!action && isPostCraftAnglePrompt(prompt));
    const postRequest = action === "post" || (!action && isPostCraftPostPrompt(prompt));

    if (angleRequest) {
      const startedAt = Date.now();
      const story = {
        topic: extractField(prompt, "Topic"),
        headline: extractField(prompt, "Headline"),
        source: extractField(prompt, "Source"),
        summary: extractField(prompt, "Summary"),
        url: extractField(prompt, "URL"),
      };
      const angles = await generateEditorialAngles(story);
      console.info(`[PostCraft] angle_route_ms=${Date.now() - startedAt} returned=${angles.length}`);
      return NextResponse.json({ text: JSON.stringify(angles) });
    }

    if (postRequest) {
      const story = {
        topic: extractField(prompt, "Topic"),
        headline: extractField(prompt, "Headline"),
        source: extractField(prompt, "Source"),
        summary: extractField(prompt, "Summary"),
        url: extractField(prompt, "URL"),
      };
      const text = await generateEditorialPost(
        story,
        extractField(prompt, "Selected angle"),
        extractField(prompt, "Why this angle works"),
        extractMode(prompt)
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
