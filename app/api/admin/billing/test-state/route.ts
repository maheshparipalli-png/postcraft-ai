import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

// Temporary admin-only helper for validating the Razorpay Test Mode flow.
// Remove this route after the end-to-end payment test is complete.
export async function POST() {
  const access = await getAdminAccess();

  if (!access.authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (!access.allowed || !access.user) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const admin = createAdminClient();
  const now = new Date();
  const trialEndsAt = new Date(now.getTime() - 60_000);
  const graceEndsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: subscription, error: updateError } = await admin
    .from("billing_subscriptions")
    .update({
      status: "grace",
      trial_ends_at: trialEndsAt.toISOString(),
      grace_ends_at: graceEndsAt.toISOString(),
      razorpay_subscription_id: null,
      razorpay_customer_id: null,
      razorpay_payment_id: null,
      razorpay_signature_verified_at: null,
      payment_verified_at: null,
      current_period_start: null,
      current_period_end: null,
      updated_at: now.toISOString(),
    })
    .eq("user_id", access.user.id)
    .select("*")
    .single();

  if (updateError) {
    console.error("Failed to prepare Razorpay test state:", updateError);
    return NextResponse.json({ error: "Unable to prepare test billing state." }, { status: 500 });
  }

  await admin.from("admin_audit_logs").insert({
    admin_user_id: access.user.id,
    target_user_id: access.user.id,
    action: "razorpay_test_state",
    reason: "Prepare current admin account for Razorpay Test Mode checkout.",
    metadata: { status: "grace", grace_hours: 24 },
  });

  return NextResponse.json({ ok: true, status: subscription.status });
}
