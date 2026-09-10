import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { generatePostCraftAngles, generatePostCraftPost } from "@/lib/ai/postcraft";

function isPostCraftAnglePrompt(prompt: string) {
  return prompt.includes("Generate SIX genuinely different, specific points of view") && prompt.includes("Return ONLY valid JSON");
}

function isPostCraftPostPrompt(prompt: string) {
  return prompt.includes("Turn ONE news development and ONE selected angle into a LinkedIn post") && prompt.includes("Selected angle:");
}

function extractField(prompt: string, field: string) {
  const match = prompt.match(new RegExp(`^${field}: (.*)$`, "m"));
  return match?.[1]?.trim() ?? "";
}

function extractMode(prompt: string) {
  if (prompt.includes("Make the thesis more pointed")) return "Make the argument more pointed and willing to take a side. Cut safe wording.";
  if (prompt.includes("smart person wrote it for another smart person")) return "Use natural, conversational language. Avoid polished corporate phrasing.";
  if (prompt.includes("Take a genuinely different route")) return "Take a different reasoning route from the obvious interpretation. Do not merely paraphrase the draft.";
  return "Write the strongest natural version of the thesis.";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    if (prompt.length > 12000) {
      return NextResponse.json(
        { error: "prompt is too long" },
        { status: 400 }
      );
    }

    if (isPostCraftAnglePrompt(prompt)) {
      const angles = await generatePostCraftAngles({
        topic: extractField(prompt, "Topic"),
        headline: extractField(prompt, "Headline"),
        source: extractField(prompt, "Source"),
        summary: extractField(prompt, "Summary"),
      });

      if (angles.length < 3) {
        return NextResponse.json({ error: "AI returned fewer than three useful angles for this story" }, { status: 502 });
      }

      return NextResponse.json({
        text: JSON.stringify(angles),
      });
    }

    if (isPostCraftPostPrompt(prompt)) {
      const text = await generatePostCraftPost(
        {
          topic: extractField(prompt, "Topic"),
          headline: extractField(prompt, "Headline"),
          source: extractField(prompt, "Source"),
          summary: extractField(prompt, "Summary"),
          whyItMatters: extractField(prompt, "Why worth exploring"),
          angle: extractField(prompt, "Selected angle"),
          angleWhy: extractField(prompt, "Why this angle works"),
        },
        extractMode(prompt)
      );

      return NextResponse.json({ text });
    }

    const text = await getAIProvider().generateText(prompt);
    return NextResponse.json({ text });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
