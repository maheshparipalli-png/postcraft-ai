import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAIProvider } from "@/lib/ai/provider";

function meta(html: string, property: string) {
  const a = new RegExp('<meta[^>]+property=["\\\']' + property + '["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']', "i").exec(html);
  const b = new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+property=["\\\']' + property + '["\\\']', "i").exec(html);
  return (a?.[1] || b?.[1] || "").trim().replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

async function generateComment(postText: string) {
  const prompt = `You are CommentCraft, a thoughtful LinkedIn commenting assistant.

Write ONE useful comment responding to this specific LinkedIn post.

Requirements:
- 45-100 words
- respond to the actual idea, not just praise or summarize it
- add one original insight, implication, practical observation, respectful counterpoint, or useful question
- natural professional language
- no generic openers such as "Great post", "Absolutely", or "Thanks for sharing"
- no invented facts, personal experiences, statistics, names, hashtags, or emojis
- do not mention AI
- one clear idea is better than several shallow points

POST:
${postText}

Return only the comment text.`;
  return (await getAIProvider().generateText(prompt, { temperature: 0.68, numPredict: 220 })).trim();
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { data: sources, error } = await supabase.from("commentcraft_sources").select("*").eq("user_id", user.id).eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ sourceId: string; status: string; message?: string }> = [];

  for (const source of sources || []) {
    try {
      const response = await fetch(source.url, { headers: { "User-Agent": "Mozilla/5.0 PostCraft CommentCraft/1.0" }, cache: "no-store" });
      const html = await response.text();
      const title = meta(html, "og:title");
      const description = meta(html, "og:description");
      const canonical = meta(html, "og:url") || source.url;
      const postText = [title, description].filter(Boolean).join("\n\n").trim();
      const isDirectPost = /linkedin\.com\/(posts\/|feed\/update\/)/i.test(source.url);

      if (!isDirectPost) {
        const message = "Profile-level automatic discovery needs LinkedIn read access; for now add direct LinkedIn post URLs.";
        await supabase.from("commentcraft_sources").update({ last_checked_at: new Date().toISOString(), last_error: message }).eq("id", source.id).eq("user_id", user.id);
        results.push({ sourceId: source.id, status: "needs_direct_post", message });
        continue;
      }

      if (!response.ok || !postText) {
        const message = "LinkedIn did not expose readable post content to the server.";
        await supabase.from("commentcraft_sources").update({ last_checked_at: new Date().toISOString(), last_error: message }).eq("id", source.id).eq("user_id", user.id);
        results.push({ sourceId: source.id, status: "unavailable", message });
        continue;
      }

      const key = Buffer.from(postText).toString("base64url").slice(0, 120);
      if (source.last_seen_key === key) {
        await supabase.from("commentcraft_sources").update({ last_checked_at: new Date().toISOString(), last_error: null }).eq("id", source.id).eq("user_id", user.id);
        results.push({ sourceId: source.id, status: "unchanged" });
        continue;
      }

      const comment = await generateComment(postText);
      const { error: postError } = await supabase.from("commentcraft_posts").insert({
        user_id: user.id,
        source_url: canonical,
        author_name: title || source.label,
        post_text: postText,
        status: "awaiting_review",
      }).select().single();
      if (postError) throw postError;

      const { data: post } = await supabase.from("commentcraft_posts").select("id").eq("user_id", user.id).eq("source_url", canonical).eq("post_text", postText).order("created_at", { ascending: false }).limit(1).single();
      if (!post) throw new Error("Could not create CommentCraft post.");

      const { error: commentError } = await supabase.from("commentcraft_comments").insert({
        post_id: post.id,
        comment_text: comment,
        angle: "Recommended response",
        preset: "thoughtful",
        status: "draft",
      });
      if (commentError) throw commentError;

      await supabase.from("commentcraft_sources").update({ last_seen_key: key, last_checked_at: new Date().toISOString(), last_error: null }).eq("id", source.id).eq("user_id", user.id);
      results.push({ sourceId: source.id, status: "new_draft" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check source.";
      await supabase.from("commentcraft_sources").update({ last_checked_at: new Date().toISOString(), last_error: message }).eq("id", source.id).eq("user_id", user.id);
      results.push({ sourceId: source.id, status: "error", message });
    }
  }

  return NextResponse.json({ results });
}
