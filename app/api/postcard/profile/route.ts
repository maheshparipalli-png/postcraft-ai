import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ authenticated: false }, { status: 401 });

  const { data, error } = await supabase
    .from("postcard_profiles")
    .select("name, handle, photo_data_url, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    authenticated: true,
    profile: data
      ? { name: data.name, handle: data.handle, photo: data.photo_data_url }
      : null,
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json();
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
  const photo = typeof body?.photo === "string" ? body.photo : null;

  if (!name || !handle) {
    return NextResponse.json({ error: "Name and handle are required." }, { status: 400 });
  }

  if (photo && photo.length > 4_000_000) {
    return NextResponse.json({ error: "Profile photo is too large." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("postcard_profiles")
    .upsert(
      { user_id: user.id, name, handle, photo_data_url: photo, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select("name, handle, photo_data_url")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: { name: data.name, handle: data.handle, photo: data.photo_data_url } });
}
