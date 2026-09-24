import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizeInterests } from "@/lib/content-interests";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await supabase
    .from("postcraft_user_preferences")
    .select("interests,interests_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Could not load content preferences." }, { status: 500 });

  return NextResponse.json({
    interests: normalizeInterests(data?.interests),
    completed: Boolean(data?.interests_completed_at && Array.isArray(data?.interests) && data.interests.length),
  });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const interests = normalizeInterests(body?.interests);
  if (!interests.length) {
    return NextResponse.json({ error: "Choose at least one area of interest." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("postcraft_user_preferences")
    .upsert({
      user_id: user.id,
      interests,
      interests_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" })
    .select("interests,interests_completed_at")
    .single();

  if (error) return NextResponse.json({ error: "Could not save content preferences." }, { status: 500 });

  return NextResponse.json({
    interests: normalizeInterests(data.interests),
    completed: Boolean(data.interests_completed_at),
  });
}
