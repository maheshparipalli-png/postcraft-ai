import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  cancelRazorpaySubscription,
  getRazorpaySubscription,
  getSafeRazorpayError,
} from "@/lib/billing/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const cancelAtCycleEnd = body?.cancelAtCycleEnd !== false;

  const { data: subscription, error: lookupError } = await supabase
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: "Unable to load your billing status." }, { status: 500 });
  }

  if (!subscription?.razorpay_subscription_id) {
    return NextResponse.json(
      { error: "No active Razorpay subscription was found for this account." },
      { status: 409 },
    );
  }

  if (subscription.status !== "active") {
    return NextResponse.json(
      { error: "There is no paid subscription available to cancel." },
      { status: 409 },
    );
  }

  const admin = createAdminClient();

  try {
    const current = await getRazorpaySubscription(subscription.razorpay_subscription_id);

    if (current.status === "cancelled" || current.status === "completed" || current.status === "expired") {
      return NextResponse.json(
        { error: "This Razorpay subscription has already ended." },
        { status: 409 },
      );
    }

    // A cycle-end cancellation preserves access through the period already paid for.
    // Razorpay keeps the subscription active until the cycle actually ends.
    const cancelled = await cancelRazorpaySubscription(
      subscription.razorpay_subscription_id,
      cancelAtCycleEnd,
    );

    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("billing_subscriptions")
      .update({
        cancel_at_cycle_end: cancelAtCycleEnd,
        cancellation_requested_at: now,
        ...(cancelAtCycleEnd ? {} : { status: "cancelled" }),
        updated_at: now,
      })
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (updateError) {
      console.error("Failed to persist cancellation request:", updateError);
      return NextResponse.json(
        { error: "Razorpay accepted the cancellation, but we could not update your account. Please contact support." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: updated.status,
      cancelAtCycleEnd,
      razorpayStatus: cancelled.status ?? current.status,
      currentPeriodEnd: updated.current_period_end ?? null,
    });
  } catch (error) {
    const detail = getSafeRazorpayError(error);
    console.error("Razorpay cancellation failed:", detail);
    return NextResponse.json(
      { error: "We could not cancel the subscription. Please try again." },
      { status: 502 },
    );
  }
}
