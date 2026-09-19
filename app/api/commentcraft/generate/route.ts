import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai/provider";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = await request.json();
  const draftId = typeof body?.draftId === "string" ? body.draftId : "";
  if (!draftId) return NextResponse.json({ error: "Draft id is required." }, { status: 400 });
  const { data: draft, error } = await supabase.from("commentcraft_drafts").select("*").eq("id", draftId).eq("user_id", user.id).single();
  if (error || !draft) return NextResponse.json({ error: "Draft not found." }, { status: 404 });
  const prompt = `You are CommentCraft, the thoughtful LinkedIn commenting assistant inside PostCraft.

Write ONE genuinely useful LinkedIn comment responding to the specific post below.

The comment must:
- respond to the actual argument, not merely praise or summarize it
- add an original insight, implication, practical observation, respectful counterpoint, or useful question
- sound like an experienced professional speaking naturally
- be concise: 45-110 words
- avoid generic openers such as Great post, Absolutely, Couldn't agree more, or Thanks for sharing
- never invent facts, personal experiences, statistics, names, or claims not supported by the post
- do not restate the post in different words
- avoid hashtags and emojis
- do not mention that you are an AI
- prefer one clear idea over several shallow points

POST:
${draft.post_text}

SOURCE URL:
${draft.post_url}

Return only the comment text.`;
  try {
    const comment = (await getAIProvider().generateText(prompt, { temperature: 0.68, numPredict: 220 })).trim();
    if (!comment) throw new Error("CommentCraft returned an empty comment.");
    const { data: updated, error: updateError } = await supabase.from("commentcraft_drafts").update({ comment_text: comment, status: "needs_review", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("user_id", user.id).select().single();
    if (updateError) throw updateError;
    return NextResponse.json({ draft: updated });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate comment." }, { status: 500 });
  }
}