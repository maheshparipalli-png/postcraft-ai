import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccess } from "@/lib/billing/access";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const billing = await getBillingAccess();
    if (!billing.authenticated) {
      return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    }
    if (!billing.allowed) {
      return NextResponse.json(
        {
          error:
            billing.status === "expired"
              ? "Your free trial has expired. Subscribe to continue."
              : "Start your free trial or subscribe to continue.",
          status: billing.status,
        },
        { status: 402 },
      );
    }

    const { id } = await params;
    const supabase = await createClient();
    const { data: userResult } = await supabase.auth.getUser();
    const user = userResult.user;
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });

    const { data: comment, error } = await supabase
      .from("commentcraft_comments")
      .select("*, post:commentcraft_posts!inner(user_id)")
      .eq("id", id)
      .eq("post.user_id", user.id)
      .single();
    if (error) throw error;

    const { error: updateError } = await supabase
      .from("commentcraft_comments")
      .update({ status: "approved", published_at: new Date().toISOString() })
      .eq("id", id);
    if (updateError) throw updateError;

    return NextResponse.json({ ok: true, comment });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Publishing failed" }, { status: 500 });
  }
}
