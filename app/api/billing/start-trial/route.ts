import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelRazorpaySubscription, getRazorpaySubscription } from "@/lib/billing/razorpay";

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

  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + TRIAL_DAYS * 86400000);
  const graceEndsAt = new Date(endsAt.getTime() + GRACE_DAYS * 86400000);

  if (existing) {
    const trialEndsAt = existing.trial_ends_at ? new Date(existing.trial_ends_at).getTime() : NaN;
    const graceEndsAtValue = existing.grace_ends_at ? new Date(existing.grace_ends_at).getTime() : NaN;
    const stillActive = existing.status === "trialing" && Number.isFinite(trialEndsAt) && trialEndsAt > Date.now();
    const stillInGrace = existing.status === "grace" && Number.isFinite(graceEndsAtValue) && graceEndsAtValue > Date.now();

    if (stillActive || stillInGrace) {
      return NextResponse.json(
        {
          error: "Your free trial is already active.",
          status: existing.status,
          subscription: existing,
        },
        { status: 409 },
      );
    }

    // A not_started row is a pre-checkout marker created by the paid
    // subscription flow. It does not mean the user has consumed the trial.
    const trialAlreadyUsed =
      Boolean(existing.trial_started_at) ||
      existing.status === "expired" ||
      existing.status === "cancelled" ||
      existing.status === "past_due" ||
      existing.status === "suspended" ||
      existing.status === "active";

    if (trialAlreadyUsed) {
      return NextResponse.json(
        {
          error: "Your free trial has already been used. Please subscribe or contact support.",
          status: existing.status,
          subscription: existing,
        },
        { status: 409 },
      );
    }

    if (existing.razorpay_subscription_id) {
      try {
        const razorpaySubscription = await getRazorpaySubscription(existing.razorpay_subscription_id);
        if (razorpaySubscription.status === "created") {
          await cancelRazorpaySubscription(existing.razorpay_subscription_id, false);
        } else if (["active", "authenticated", "pending", "halted"].includes(razorpaySubscription.status)) {
          return NextResponse.json(
            { error: "A paid Razorpay subscription is already in progress. Please complete or cancel it before starting the free trial." },
            { status: 409 },
          );
        }
      } catch (error) {
        console.error("Could not verify existing Razorpay subscription before trial:", error);
        return NextResponse.json(
          { error: error instanceof Error ? error.message : "Unable to verify your existing subscription." },
          { status: 502 },
        );
      }
    }

    const { data: subscription, error: updateError } = await admin
      .from("billing_subscriptions")
      .update({
        plan_key: existing.plan_key || "pro_monthly",
        status: "trialing",
        trial_started_at: startedAt.toISOString(),
        trial_ends_at: endsAt.toISOString(),
        grace_ends_at: graceEndsAt.toISOString(),
        cancel_at_cycle_end: false,
        cancellation_requested_at: null,
        razorpay_subscription_id: null,
        razorpay_customer_id: null,
        razorpay_payment_id: null,
        razorpay_signature_verified_at: null,
        payment_verified_at: null,
        current_period_start: null,
        current_period_end: null,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("status", "not_started")
      .is("trial_started_at", null)
      .select("*")
      .single();

    if (updateError || !subscription) {
      console.error("Trial activation error:", updateError);
      return NextResponse.json({ error: "Unable to start your free trial. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ status: "trialing", subscription });
  }

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
