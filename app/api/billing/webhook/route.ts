import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature, unixToIso } from "@/lib/billing/razorpay";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "PostCraft Razorpay webhook",
    endpoint: "/api/billing/webhook",
    accepts: "POST",
  });
}

type RazorpayEntity = {
  id?: string;
  status?: string;
  customer_id?: string;
  payment_id?: string;
  subscription_id?: string;
  current_start?: number;
  current_end?: number;
};

type RazorpayWebhookPayload = {
  event?: unknown;
  payload?: {
    subscription?: { entity?: RazorpayEntity };
    payment?: { entity?: RazorpayEntity };
  };
};

function getSubscriptionEntity(payload: RazorpayWebhookPayload): RazorpayEntity {
  return payload?.payload?.subscription?.entity ?? {};
}

function getPaymentEntity(payload: RazorpayWebhookPayload): RazorpayEntity {
  return payload?.payload?.payment?.entity ?? {};
}

function mapStatus(event: string, entityStatus?: string) {
  if (event === "subscription.activated" || event === "subscription.charged") return "active";
  if (event === "subscription.pending" || event === "payment.failed") return "past_due";
  if (event === "subscription.halted") return "suspended";
  if (event === "subscription.cancelled") return "cancelled";
  if (event === "subscription.completed" || event === "subscription.expired") return "expired";

  if (entityStatus === "active") return "active";
  if (entityStatus === "pending") return "past_due";
  if (entityStatus === "halted") return "suspended";
  if (entityStatus === "cancelled") return "cancelled";
  if (entityStatus === "completed" || entityStatus === "expired") return "expired";

  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = request.headers.get("x-razorpay-event-id") ?? "";

  if (!signature) return NextResponse.json({ error: "Missing webhook signature" }, { status: 400 });
  if (!eventId) return NextResponse.json({ error: "Missing webhook event id" }, { status: 400 });

  try {
    if (!verifyWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }
  } catch (error) {
    console.error("Razorpay webhook configuration error:", error);
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }

  let payload: RazorpayWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "";
  const admin = createAdminClient();

  const { data: existingEvent } = await admin
    .from("razorpay_webhook_events")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existingEvent) return NextResponse.json({ ok: true, duplicate: true });

  const subscriptionEntity = getSubscriptionEntity(payload);
  const paymentEntity = getPaymentEntity(payload);
  const razorpaySubscriptionId = subscriptionEntity.id ?? paymentEntity.subscription_id ?? null;

  if (!razorpaySubscriptionId) {
    await admin.from("razorpay_webhook_events").insert({
      event_id: eventId,
      event_type: event || "unknown",
      payload,
    });
    return NextResponse.json({ ok: true, ignored: true });
  }

  const { data: localSubscription, error: lookupError } = await admin
    .from("billing_subscriptions")
    .select("id,user_id,status,razorpay_subscription_id")
    .eq("razorpay_subscription_id", razorpaySubscriptionId)
    .maybeSingle();

  if (lookupError) {
    console.error("Razorpay webhook subscription lookup failed:", lookupError);
    return NextResponse.json({ error: "Unable to process webhook" }, { status: 500 });
  }

  if (!localSubscription) {
    const { error: eventError } = await admin
      .from("razorpay_webhook_events")
      .insert({
        event_id: eventId,
        event_type: event || "unknown",
        payload,
      });

    if (eventError && eventError.code !== "23505") {
      console.error("Razorpay webhook ignored-event persistence failed:", eventError);
      return NextResponse.json({ error: "Unable to record webhook event" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, ignored: true });
  }

  const nextStatus = mapStatus(event, subscriptionEntity.status);
  const paymentId = paymentEntity.id ?? paymentEntity.payment_id ?? null;
  const currentStart = unixToIso(subscriptionEntity.current_start);
  const currentEnd = unixToIso(subscriptionEntity.current_end);

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (nextStatus) updates.status = nextStatus;
  if (subscriptionEntity.customer_id) updates.razorpay_customer_id = subscriptionEntity.customer_id;
  if (paymentId) updates.razorpay_payment_id = paymentId;
  if (currentStart) updates.current_period_start = currentStart;
  if (currentEnd) updates.current_period_end = currentEnd;

  const { error: updateError } = await admin
    .from("billing_subscriptions")
    .update(updates)
    .eq("id", localSubscription.id);

  if (updateError) {
    console.error("Razorpay webhook subscription update failed:", updateError);
    return NextResponse.json({ error: "Unable to update subscription" }, { status: 500 });
  }

  const { error: eventError } = await admin
    .from("razorpay_webhook_events")
    .insert({
      event_id: eventId,
      event_type: event || "unknown",
      payload,
    });

  if (eventError && eventError.code !== "23505") {
    console.error("Razorpay webhook event persistence failed:", eventError);
    return NextResponse.json({ error: "Unable to record webhook event" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
