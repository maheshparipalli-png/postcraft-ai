import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifySubscriptionSignature } from "@/lib/billing/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const paymentId = typeof body?.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
  const subscriptionId = typeof body?.razorpay_subscription_id === "string" ? body.razorpay_subscription_id : "";
  const signature = typeof body?.razorpay_signature === "string" ? body.razorpay_signature : "";

  if (!paymentId || !subscriptionId || !signature) {
    return NextResponse.json({ error: "Incomplete Razorpay payment response" }, { status: 400 });
  }

  const { data: subscription, error: lookupError } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError || !subscription) {
    return NextResponse.json({ error: "Subscription record not found" }, { status: 404 });
  }

  if (subscription.razorpay_subscription_id !== subscriptionId) {
    return NextResponse.json({ error: "Subscription does not belong to this account" }, { status: 403 });
  }

  if (!verifySubscriptionSignature(paymentId, subscriptionId, signature)) {
    return NextResponse.json({ error: "Invalid Razorpay signature" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { data: razorpaySubscription } = await import("@/lib/billing/razorpay").then(({ getRazorpaySubscription }) => getRazorpaySubscription(subscriptionId));

  if (!razorpaySubscription || !["authenticated", "active"].includes(razorpaySubscription.status)) {
    return NextResponse.json({ error: "Payment was verified, but Razorpay has not activated the subscription yet. We will update your account automatically when the subscription becomes active.", paymentVerified: true, status: subscription.status }, { status: 202 });
  }

  const { data: updated, error } = await admin
    .from("billing_subscriptions")
    .update({
      razorpay_payment_id: paymentId,
      razorpay_signature_verified_at: now,
      payment_verified_at: now,
      status: "active",
      razorpay_customer_id: razorpaySubscription.customer_id ?? subscription.razorpay_customer_id ?? null,
      current_period_start: razorpaySubscription.current_start ? new Date(razorpaySubscription.current_start * 1000).toISOString() : subscription.current_period_start ?? now,
      current_period_end: razorpaySubscription.current_end ? new Date(razorpaySubscription.current_end * 1000).toISOString() : subscription.current_period_end ?? null,
      updated_at: now,
    })
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to activate Razorpay subscription:", error);
    return NextResponse.json({ error: "Payment verified, but subscription activation failed. Please contact support." }, { status: 500 });
  }

  return NextResponse.json({ status: updated.status, paymentVerified: true, subscription: updated });
}
