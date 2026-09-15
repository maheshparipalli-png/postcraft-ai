import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai/provider";

type GeneratedComment = { angle: string; comment: string };

function extractJson(raw: string): unknown {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const firstArray = cleaned.indexOf("[");
    const lastArray = cleaned.lastIndexOf("]");
    if (firstArray >= 0 && lastArray > firstArray) {
      try {
        return JSON.parse(cleaned.slice(firstArray, lastArray + 1));
      } catch {
        // Continue to wrapped-object extraction below.
      }
    }

    const firstObject = cleaned.indexOf("{");
    const lastObject = cleaned.lastIndexOf("}");
    if (firstObject >= 0 && lastObject > firstObject) {
      try {
        return JSON.parse(cleaned.slice(firstObject, lastObject + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function normalizeGenerated(raw: string): GeneratedComment[] {
  type GeneratedCandidate = {
    angle?: unknown;
    title?: unknown;
    label?: unknown;
    comment?: unknown;
    text?: unknown;
    content?: unknown;
    body?: unknown;
  };

  type GeneratedPayload = {
    comments?: unknown;
    options?: unknown;
    choices?: unknown;
    comment?: unknown;
  };

  const parsed = extractJson(raw) as
    | GeneratedCandidate
    | GeneratedCandidate[]
    | GeneratedPayload
    | null;

  const isGeneratedPayload = (
    value: GeneratedCandidate | GeneratedPayload
  ): value is GeneratedPayload => {
    return (
      "comments" in value ||
      "options" in value ||
      "choices" in value
    );
  };

  const candidates: GeneratedCandidate[] = Array.isArray(parsed)
    ? parsed
    : parsed && isGeneratedPayload(parsed) && Array.isArray(parsed.comments)
      ? parsed.comments as GeneratedCandidate[]
      : parsed && isGeneratedPayload(parsed) && Array.isArray(parsed.options)
        ? parsed.options as GeneratedCandidate[]
        : parsed && isGeneratedPayload(parsed) && Array.isArray(parsed.choices)
          ? parsed.choices as GeneratedCandidate[]
          : parsed && "comment" in parsed && parsed.comment
            ? [parsed]
            : [];

  return candidates
    .map((item: GeneratedCandidate) => ({
      angle: String(item?.angle ?? item?.title ?? item?.label ?? "").trim(),
      comment: String(item?.comment ?? item?.text ?? item?.content ?? item?.body ?? "").trim(),
    }))
    .filter((item: GeneratedComment) => {
      if (!item.angle || !item.comment) return false;
      if (item.angle.length > 80) return false;
      if (/[.!?]/.test(item.angle)) return false;
      if (/\b(i|me|my|mine|we|our|us)\b/i.test(item.angle)) return false;
      return true;
    });
}
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sourceUrl = String(body.sourceUrl || "").trim() || null;
    const postText = String(body.postText || "").trim();
    const summary = String(body.summary || "").trim();
    const preset = String(body.preset || "thoughtful");
    const userIdea = String(body.userIdea || "").trim();

    if (!postText) {
      return NextResponse.json(
        { error: "For now, paste the post text so Commentcraft can analyze it." },
        { status: 400 },
      );
    }

    const prompt = `You are Commentcraft, an expert LinkedIn comment assistant. Analyze the supplied post and generate exactly 4 distinct, human-sounding LinkedIn comment options. Preset: ${preset}.

Return ONLY valid JSON. Prefer this exact shape:
[
  { "angle": "Short descriptive label", "comment": "The actual LinkedIn comment" }
]
The response may contain exactly these two string fields per item. The angle should be 2-6 simple words, not a sentence, and should not contain punctuation. The comment should be 25-70 words, 1-3 sentences, natural and specific to the post.

Use simple, everyday English. Make each comment easy to understand on the first reading. Write as if explaining the idea to an intelligent friend. Prefer familiar words, short sentences, and one clear point. Avoid jargon, academic or philosophical language, complicated sentence structures, corporate wording, clichÃ©s, and unnecessarily polished phrasing. Do not try to sound profound; sound human, clear, and relevant.

Add an observation, distinction, implication, or thoughtful question. Avoid generic praise, invented personal experiences, hashtags, and unsupported assumptions. Make the four comments meaningfully different from one another.

${userIdea ? `USER KEYWORD OR IDEA:
${userIdea}

Exactly one of the four comments must be built around this user-provided idea. Give that option an angle such as "Your perspective" or another clear label. Use the idea naturally; do not merely repeat it. The other three comments should be based primarily on the original post.` : "No user keyword or idea was provided. Base all four comments on the original post."}

POST SUMMARY (optional):
${summary || "No separate summary was provided."}

POST:
${postText}`;

    const raw = await getAIProvider().generateText(prompt);
    console.info("[commentcraft/import] Raw AI response:", raw);

    const generated = normalizeGenerated(raw);
    if (!generated.length) {
      return NextResponse.json(
        { error: "The AI response could not be converted into usable comments. Please try again." },
        { status: 502 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }

    const { data: post, error } = await supabase
      .from("commentcraft_posts")
      .insert({
        user_id: user.id,
        source_url: sourceUrl,
        author_name: null,
        post_text: postText,
        status: "awaiting_review",
      })
      .select()
      .single();

    if (error) throw error;

    const rows = generated.slice(0, 6).map((item) => ({
      post_id: post.id,
      comment_text: item.comment,
      angle: item.angle || "Comment option",
      preset,
      status: "draft",
    }));

    if (rows.length) {
      const { error: commentsError } = await supabase.from("commentcraft_comments").insert(rows);
      if (commentsError) throw commentsError;
    }

    return NextResponse.json({ post: { ...post } });
  } catch (error) {
    console.error("[commentcraft/import] Import failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 },
    );
  }
}



