import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRazorpaySubscription, getRazorpayPublicKey, getRazorpaySubscription, getSafeRazorpayError } from "@/lib/billing/razorpay";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: existing, error: lookupError } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) return NextResponse.json({ error: "Unable to load billing status" }, { status: 500 });

  const admin = createAdminClient();

  if (!existing) {
    const { error: insertError } = await admin
      .from("billing_subscriptions")
      .insert({
        user_id: user.id,
        plan_key: "pro_monthly",
        status: "not_started",
      });

    if (insertError && insertError.code !== "23505") {
      console.error("Failed to initialize billing subscription:", insertError);
      return NextResponse.json({ error: "Unable to prepare your subscription. Please try again." }, { status: 500 });
    }
  }

  const { data: billing, error: billingError } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (billingError || !billing) {
    return NextResponse.json({ error: "Unable to prepare your subscription. Please try again." }, { status: 500 });
  }

  const current = billing;
  if (current.status === "active") {
    return NextResponse.json({ error: "Your subscription is already active.", subscription: current }, { status: 409 });
  }

  // Reuse an existing Razorpay subscription while checkout is still in progress.
  // Local billing statuses do not mirror Razorpay's "created"/"authenticated" states,
  // so grace/past_due are the states in which an existing checkout can be resumed.
  if (current.razorpay_subscription_id) {
    try {
      const razorpaySubscription = await getRazorpaySubscription(current.razorpay_subscription_id);
      if (["created", "authenticated", "active"].includes(razorpaySubscription.status)) {
        return NextResponse.json({
          keyId: getRazorpayPublicKey(),
          subscriptionId: razorpaySubscription.id,
          shortUrl: razorpaySubscription.short_url ?? null,
        });
      }
    } catch (error) {
      console.warn("Existing Razorpay subscription could not be resumed:", error);
    }
  }

  let subscription;
  try {
    subscription = await createRazorpaySubscription({
      userId: user.id,
      email: user.email,
      name: user.user_metadata?.full_name ?? user.user_metadata?.name,
    });

    // Fetch the newly created subscription once more so the hosted authorisation
    // URL is available even if the create response omits it.
    if (!subscription.short_url) {
      subscription = await getRazorpaySubscription(subscription.id);
    }
  } catch (error) {
    const detail = getSafeRazorpayError(error);
    console.error("Razorpay subscription creation failed:", detail);
    return NextResponse.json(
      { error: `Razorpay checkout could not be created: ${detail}` },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { error: updateError } = await admin
    .from("billing_subscriptions")
    .update({
      razorpay_subscription_id: subscription.id,
      razorpay_customer_id: subscription.customer_id ?? null,
      razorpay_payment_id: null,
      razorpay_signature_verified_at: null,
      payment_verified_at: null,
      current_period_start: null,
      current_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to persist Razorpay subscription:", updateError);
    return NextResponse.json({ error: "Unable to prepare your subscription. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    checkoutVersion: "2026-09-23-billing-v3",
    keyId: getRazorpayPublicKey(),
    subscriptionId: subscription.id,
    shortUrl: subscription.short_url ?? null,
  });
}
