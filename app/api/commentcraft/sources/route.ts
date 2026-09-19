import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const { data, error } = await supabase.from("commentcraft_sources").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ sources: data || [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const body = await request.json();
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  if (!url || !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Enter a valid source URL." }, { status: 400 });
  const { data, error } = await supabase.from("commentcraft_sources").upsert({ user_id: user.id, url, label: label || new URL(url).hostname, active: true }, { onConflict: "user_id,url" }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ source: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Source id is required." }, { status: 400 });
  const { error } = await supabase.from("commentcraft_sources").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
