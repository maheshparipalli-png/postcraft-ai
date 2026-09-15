import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Billing status error:", error);
    return NextResponse.json({ error: "Unable to load billing status" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ status: "not_started", subscription: null });
  }

  const now = Date.now();
  const trialExpired = data.status === "trialing" && data.trial_ends_at
    ? new Date(data.trial_ends_at).getTime() <= now
    : false;

  return NextResponse.json({
    status: trialExpired ? "expired" : data.status,
    subscription: data,
  });
}
