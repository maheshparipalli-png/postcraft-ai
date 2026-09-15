import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function todayInIndia() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function errorDetails(error: unknown) {
  if (!error || typeof error !== "object") return "Unknown database error.";
  const value = error as { message?: string; code?: string; details?: string; hint?: string };
  return [value.message, value.code ? `code=${value.code}` : "", value.details, value.hint ? `hint=${value.hint}` : ""].filter(Boolean).join(" | ") || "Unknown database error.";
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ draft: null, persistent: false });
    const { data, error } = await supabase.from("postcraft_daily_drafts").select("*").eq("user_id", user.id).eq("draft_date", todayInIndia()).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ draft: data, persistent: true });
  } catch (error) {
    return NextResponse.json({ error: "Could not load draft.", details: errorDetails(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const body = await request.json().catch(() => ({}));
    const preview = body.preview;
    const replace = body.replace === true;
    if (!preview?.post || !preview?.article?.url) return NextResponse.json({ error: "A complete preview is required." }, { status: 400 });

    if (!user) return NextResponse.json({ draft: null, persistent: false, saved: false, preview });

    const draftDate = todayInIndia();
    const { data: existing, error: existingError } = await supabase.from("postcraft_daily_drafts").select("*").eq("user_id", user.id).eq("draft_date", draftDate).maybeSingle();
    if (existingError) throw existingError;
    if (existing?.status === "published") return NextResponse.json({ draft: existing, locked: true, persistent: true, error: "This daily draft has already been published and cannot be replaced." }, { status: 409 });
    if (existing && !replace) return NextResponse.json({ draft: existing, locked: true, persistent: true });

    const row = { user_id: user.id, draft_date: draftDate, status: "ready", source_url: preview.article.url, source_title: preview.article.title, source_name: preview.article.source, generated_post: preview.post, working_post: preview.post, recommended_angle: preview.angle?.angle || null, angle_why: preview.angle?.why || null, ranking_reason: preview.ranking?.reason || null, candidate_count: preview.ranking?.candidateCount || null, verification_status: "verified", updated_at: new Date().toISOString() };
    const { data, error } = await supabase.from("postcraft_daily_drafts").upsert(row, { onConflict: "user_id,draft_date" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ draft: data, locked: true, persistent: true, replaced: Boolean(existing) });
  } catch (error) {
    console.error("Could not save daily draft:", error);
    return NextResponse.json({ error: "Could not save draft.", details: errorDetails(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.status === "string") updates.status = body.status;
    if (typeof body.linkedinPostId === "string") { updates.linkedin_post_id = body.linkedinPostId; updates.published_at = new Date().toISOString(); }
    const { data, error } = await supabase.from("postcraft_daily_drafts").update(updates).eq("user_id", user.id).eq("draft_date", todayInIndia()).select("*").single();
    if (error) throw error;
    return NextResponse.json({ draft: data });
  } catch (error) {
    return NextResponse.json({ error: "Could not update draft.", details: errorDetails(error) }, { status: 500 });
  }
}
