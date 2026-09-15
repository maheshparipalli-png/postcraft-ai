import { NextResponse } from "next/server";
import { getAIProvider } from "@/lib/ai/provider";
import { getBillingAccess } from "@/lib/billing/access";

export async function POST(request: Request) {
  try {
    const billing = await getBillingAccess();
    if (!billing.authenticated) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }
    if (!billing.allowed) {
      return NextResponse.json(
        {
          error:
            billing.status === "expired"
              ? "Your free trial has expired. Subscribe to continue."
              : "Start your free trial or subscribe to continue.",
          status: billing.status,
        },
        { status: 402 },
      );
    }

    const body = await request.json();
    const postText = String(body.postText || "").trim();

    if (!postText) {
      return NextResponse.json({ error: "Paste the post text before generating a summary." }, { status: 400 });
    }

    const prompt = `You are Commentcraft, an editorial assistant. Summarize the supplied LinkedIn post so another writer can understand its central message before writing a comment.

Return only the summary text. Use 1-2 sentences and 30-60 words. Use simple, everyday English. State the main point and any important distinction or implication. Do not add opinions, praise, unsupported facts, markdown, quotation marks, or phrases such as "the author says".

POST:
${postText}`;

    const raw = await getAIProvider().generateText(prompt);
    const summary = raw
      .replace(/^\s*```(?:text|markdown)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .replace(/^['"]|['"]$/g, "")
      .trim();

    if (!summary) {
      return NextResponse.json({ error: "The AI did not return a usable summary. Please try again." }, { status: 502 });
    }

    return NextResponse.json({ summary: summary.slice(0, 1000) });
  } catch (error) {
    console.error("[commentcraft/summarize] Summary generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Summary generation failed." },
      { status: 500 },
    );
  }
}
