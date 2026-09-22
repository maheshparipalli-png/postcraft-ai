import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createRazorpaySubscription, getRazorpayPublicKey } from "@/lib/billing/razorpay";

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

  if (!existing) {
    return NextResponse.json({ error: "Start your free trial before subscribing." }, { status: 409 });
  }

  if (existing.status === "active") {
    return NextResponse.json({ error: "Your subscription is already active.", subscription: existing }, { status: 409 });
  }

  if (existing.razorpay_subscription_id &&
      ["created", "authenticated", "pending"].includes(existing.status)) {
    return NextResponse.json({
      keyId: getRazorpayPublicKey(),
      subscriptionId: existing.razorpay_subscription_id,
    });
  }

  if (existing.status === "trialing") {
    const trialEnds = existing.trial_ends_at ? new Date(existing.trial_ends_at).getTime() : NaN;
    if (Number.isFinite(trialEnds) && trialEnds > Date.now()) {
      return NextResponse.json({ error: "Your free trial is still active. You can subscribe after the trial ends." }, { status: 409 });
    }
  }

  const subscription = await createRazorpaySubscription({
    userId: user.id,
    email: user.email,
    name: user.user_metadata?.full_name ?? user.user_metadata?.name,
  });

  const { error: updateError } = await supabase
    .from("billing_subscriptions")
    .update({
      razorpay_subscription_id: subscription.id,
      razorpay_customer_id: subscription.customer_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    console.error("Failed to persist Razorpay subscription:", updateError);
    return NextResponse.json({ error: "Unable to prepare your subscription. Please try again." }, { status: 500 });
  }

  return NextResponse.json({
    keyId: getRazorpayPublicKey(),
    subscriptionId: subscription.id,
  });
}
