import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const body = await request.json();
    const template = typeof body?.template === "string" ? body.template : "editorial";
    const background = typeof body?.background === "string" ? body.background : "paper";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const handle = typeof body?.handle === "string" ? body.handle.trim() : "";
    const photo = typeof body?.photo === "string" ? body.photo : null;
    const headline = typeof body?.headline === "string" ? body.headline.trim() : "";
    const cardBody = typeof body?.body === "string" ? body.body.trim() : "";
    const closing = typeof body?.closing === "string" ? body.closing.trim() : "";
    const stat = typeof body?.stat === "string" ? body.stat.trim() : "";
    const statLabel = typeof body?.statLabel === "string" ? body.statLabel.trim() : "";
    const source = typeof body?.source === "string" ? body.source.trim() : "";\n    const quoteHash = typeof body?.quoteHash === "string" ? body.quoteHash.trim() : "";\n    const quoteText = typeof body?.quoteText === "string" ? body.quoteText.trim() : "";\n    const quoteAuthor = typeof body?.quoteAuthor === "string" ? body.quoteAuthor.trim() : "";\n    const quoteCategory = typeof body?.quoteCategory === "string" ? body.quoteCategory.trim() : "";

    if (!headline && !stat) {
      return NextResponse.json({ error: "There is no card content to save yet." }, { status: 400 });
    }
    if (photo && photo.length > 4_000_000) {
      return NextResponse.json({ error: "Profile photo is too large." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("postcard_cards")
      .insert({
        user_id: user.id,
        template,
        background,
        name,
        handle,
        photo_data_url: photo,
        headline,
        body: cardBody,
        closing,
        stat,
        stat_label: statLabel,
        source,
      })
      .select("id, created_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ saved: true, id: data.id, createdAt: data.created_at });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save the PostCard." },
      { status: 500 },
    );
  }
}
