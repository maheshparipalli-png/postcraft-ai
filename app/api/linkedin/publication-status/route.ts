import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

function contentHash(commentary: string) {
  return createHash("sha256")
    .update(commentary.toLowerCase().replace(/\s+/g, " ").trim())
    .digest("hex");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const commentary = typeof body?.commentary === "string" ? body.commentary.trim() : "";
    if (!commentary) return NextResponse.json({ published: false });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ published: false });

    const hash = contentHash(commentary);
    const { data, error } = await supabase
      .from("postcraft_publications")
      .select("id, linkedin_post_id, published_at")
      .eq("user_id", user.id)
      .eq("content_hash", hash)
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      published: Boolean(data),
      linkedinPostId: data?.linkedin_post_id ?? null,
      publishedAt: data?.published_at ?? null,
    });
  } catch {
    return NextResponse.json({ published: false });
  }
}
