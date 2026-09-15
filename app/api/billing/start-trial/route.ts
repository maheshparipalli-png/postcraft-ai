import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: existing, error: lookupError } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("Trial lookup error:", lookupError);
    return NextResponse.json({ error: "Unable to check trial eligibility" }, { status: 500 });
  }

  if (existing) {
    const trialExpired = existing.status === "trialing" && existing.trial_ends_at
      ? new Date(existing.trial_ends_at).getTime() <= Date.now()
      : false;

    return NextResponse.json(
      {
        error: trialExpired ? "Your free trial has expired" : "Your free trial has already been used",
        status: trialExpired ? "expired" : existing.status,
        subscription: existing,
      },
      { status: 409 },
    );
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + 24 * 60 * 60 * 1000);

  const { data: subscription, error: insertError } = await supabase
    .from("billing_subscriptions")
    .insert({
      user_id: user.id,
      plan_key: "pro_monthly",
      status: "trialing",
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Trial creation error:", insertError);
    return NextResponse.json({ error: "Unable to start your free trial" }, { status: 500 });
  }

  return NextResponse.json({ status: "trialing", subscription });
}
