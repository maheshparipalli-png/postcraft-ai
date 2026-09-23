import { NextResponse } from "next/server";
import { getBillingAccess } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await getBillingAccess();

  if (!access.authenticated) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  if (access.status === "billing_unavailable") {
    return NextResponse.json({ error: "Unable to load billing status" }, { status: 500 });
  }

  const subscription = access.subscription
    ? {
        status: access.subscription.status,
        plan_key: access.subscription.plan_key ?? null,
        trial_started_at: access.subscription.trial_started_at ?? null,
        trial_ends_at: access.subscription.trial_ends_at ?? null,
        grace_ends_at: access.subscription.grace_ends_at ?? null,
        current_period_start: access.subscription.current_period_start ?? null,
        current_period_end: access.subscription.current_period_end ?? null,
      }
    : null;

  return NextResponse.json({
    status: access.status,
    allowed: access.allowed,
    subscription,
  });
}
