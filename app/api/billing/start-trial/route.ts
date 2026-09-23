import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const TRIAL_DAYS = 15;
const GRACE_DAYS = 3;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    console.error("Trial lookup error:", lookupError);
    return NextResponse.json({ error: "Unable to check trial eligibility" }, { status: 500 });
  }

  if (existing) {
    const trialEndsAt = existing.trial_ends_at ? new Date(existing.trial_ends_at).getTime() : NaN;
    const graceEndsAt = existing.grace_ends_at ? new Date(existing.grace_ends_at).getTime() : NaN;
    const stillActive = existing.status === "trialing" && Number.isFinite(trialEndsAt) && trialEndsAt > Date.now();
    const stillInGrace = existing.status === "grace" && Number.isFinite(graceEndsAt) && graceEndsAt > Date.now();

    return NextResponse.json(
      {
        error: stillActive || stillInGrace
          ? "Your free trial is already active."
          : "Your free trial has already been used. Please subscribe or contact support.",
        status: existing.status,
        subscription: existing,
      },
      { status: 409 },
    );
  }

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + TRIAL_DAYS * 86400000);
  const graceEndsAt = new Date(endsAt.getTime() + GRACE_DAYS * 86400000);

  const { data: subscription, error: insertError } = await admin
    .from("billing_subscriptions")
    .insert({
      user_id: user.id,
      plan_key: "pro_monthly",
      status: "trialing",
      trial_started_at: startedAt.toISOString(),
      trial_ends_at: endsAt.toISOString(),
      grace_ends_at: graceEndsAt.toISOString(),
    })
    .select("*")
    .single();

  if (insertError) {
    console.error("Trial creation error:", insertError);
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Your free trial has already been used", status: "already_used" }, { status: 409 });
    }
    return NextResponse.json({ error: "Unable to start your free trial" }, { status: 500 });
  }

  return NextResponse.json({ status: "trialing", subscription });
}
