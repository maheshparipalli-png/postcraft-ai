import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data, error } = await supabase.from("commentcraft_drafts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ drafts: data || [] });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = await request.json();
  const id = typeof body?.id === "string" ? body.id : "";
  const commentText = typeof body?.commentText === "string" ? body.commentText.trim() : "";
  const status = typeof body?.status === "string" ? body.status : "needs_review";
  if (!id) return NextResponse.json({ error: "Draft id is required." }, { status: 400 });
  const { data, error } = await supabase.from("commentcraft_drafts").update({ comment_text: commentText, status, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", user.id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ draft: data });
}