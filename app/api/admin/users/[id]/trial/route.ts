import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const days = Number(body?.days);
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (!Number.isInteger(days) || days < 1 || days > 365) {
    return NextResponse.json({ error: "Days must be an integer between 1 and 365." }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

  const admin = createAdminClient();
  const now = new Date();
  const trialEnds = new Date(now.getTime() + days * 86400000);
  const graceEnds = new Date(trialEnds.getTime() + 3 * 86400000);

  const { data: existing } = await admin
    .from("billing_subscriptions")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();

  if (existing) {
    if (existing.razorpay_subscription_id) {
      return NextResponse.json(
        { error: "Cannot reset a trial while a Razorpay subscription is linked to this account." },
        { status: 409 },
      );
    }

    const { data, error } = await admin
      .from("billing_subscriptions")
      .update({
        status: "trialing",
        trial_started_at: now.toISOString(),
        trial_ends_at: trialEnds.toISOString(),
        grace_ends_at: graceEnds.toISOString(),
        razorpay_subscription_id: null,
        razorpay_customer_id: null,
        razorpay_payment_id: null,
        razorpay_signature_verified_at: null,
        payment_verified_at: null,
        current_period_start: null,
        current_period_end: null,
        trial_reset_count: (existing.trial_reset_count ?? 0) + 1,
        last_trial_reset_at: now.toISOString(),
        last_trial_reset_reason: reason,
      })
      .eq("user_id", id)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("admin_audit_logs").insert({
      admin_user_id: access.user!.id,
      target_user_id: id,
      action: "trial_reset",
      reason,
      metadata: {
        days,
        previous_status: existing.status,
        previous_trial_ends_at: existing.trial_ends_at,
        previous_razorpay_subscription_id: existing.razorpay_subscription_id,
      },
    });

    return NextResponse.json({ subscription: data });
  }

  const { data, error } = await admin
    .from("billing_subscriptions")
    .insert({
      user_id: id,
      plan_key: "pro_monthly",
      status: "trialing",
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
      grace_ends_at: graceEnds.toISOString(),
      trial_reset_count: 1,
      last_trial_reset_at: now.toISOString(),
      last_trial_reset_reason: reason,
    })
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_logs").insert({
    admin_user_id: access.user!.id,
    target_user_id: id,
    action: "trial_started_by_admin",
    reason,
    metadata: { days },
  });

  return NextResponse.json({ subscription: data });
}
