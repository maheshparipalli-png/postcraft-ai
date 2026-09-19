import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function extractMeta(html: string, property: string) {
  const patterns = [
    new RegExp('<meta[^>]+property=["\\\']' + property + '["\\\'][^>]+content=["\\\']([^"\\\']*)["\\\']', "i"),
    new RegExp('<meta[^>]+content=["\\\']([^"\\\']*)["\\\'][^>]+property=["\\\']' + property + '["\\\']', "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return "";
}

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

  const { data: sources, error } = await supabase.from("commentcraft_sources").select("*").eq("user_id", user.id).eq("active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ sourceId: string; status: string; message?: string; draftId?: string }> = [];

  for (const source of sources || []) {
    try {
      const response = await fetch(source.url, {
        headers: { "User-Agent": "Mozilla/5.0 PostCraft CommentCraft/1.0" },
        cache: "no-store",
      });
      const html = await response.text();
      const title = decode(extractMeta(html, "og:title"));
      const description = decode(extractMeta(html, "og:description"));
      const canonical = decode(extractMeta(html, "og:url")) || source.url;
      const postText = [title, description].filter(Boolean).join("\n\n").trim();

      const isLikelyLinkedInPost = /linkedin\.com\/(posts\/|feed\/update\/)/i.test(source.url);
      if (!response.ok || !postText) {
        results.push({ sourceId: source.id, status: "unavailable", message: isLikelyLinkedInPost ? "LinkedIn did not expose the post content to the server." : "The source did not expose readable metadata." });
      } else if (!isLikelyLinkedInPost) {
        results.push({ sourceId: source.id, status: "needs_post_url", message: "For the first CommentCraft version, use a direct LinkedIn post URL rather than a profile URL." });
      } else {
        const key = Buffer.from(postText).toString("base64url").slice(0, 120);
        if (source.last_seen_key !== key) {
          const { data: draft, error: draftError } = await supabase
            .from("commentcraft_drafts")
            .insert({ user_id: user.id, source_id: source.id, post_url: canonical, author: title.split(" | ")[0] || source.label, post_text: postText, status: "needs_review" })
            .select()
            .single();
          if (draftError) throw draftError;
          await supabase.from("commentcraft_sources").update({ last_seen_key: key, last_checked_at: new Date().toISOString(), last_error: null }).eq("id", source.id).eq("user_id", user.id);
          results.push({ sourceId: source.id, status: "new_post", draftId: draft.id });
        } else {
          await supabase.from("commentcraft_sources").update({ last_checked_at: new Date().toISOString(), last_error: null }).eq("id", source.id).eq("user_id", user.id);
          results.push({ sourceId: source.id, status: "unchanged" });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check source.";
      await supabase.from("commentcraft_sources").update({ last_checked_at: new Date().toISOString(), last_error: message }).eq("id", source.id).eq("user_id", user.id);
      results.push({ sourceId: source.id, status: "error", message });
    }
  }

  return NextResponse.json({ results });
}
