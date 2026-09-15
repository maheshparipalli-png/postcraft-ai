import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccess } from "@/lib/billing/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireBillingAccess() {
  const billing = await getBillingAccess();
  if (!billing.authenticated) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }
  if (!billing.allowed) {
    return NextResponse.json(
      {
        error:
          billing.status === "expired"
            ? "Your free trial has expired. Subscribe to continue."
            : "Start your free trial or subscribe to continue.",
        status: billing.status,
      },
      { status: 402 },
    );
  }
  return null;
}

export async function GET() {
  try {
    const billingError = await requireBillingAccess();
    if (billingError) return billingError;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    const { data, error } = await supabase.from("postcraft_schedules").select("*").eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ schedule: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load schedule." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const billingError = await requireBillingAccess();
    if (billingError) return billingError;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    const enabled = Boolean(body.enabled);
    const publishTime = typeof body.publishTime === "string" ? body.publishTime : "08:00";
    const timezone = typeof body.timezone === "string" ? body.timezone : "Asia/Kolkata";
    const mode = body.mode === "automatic" ? "automatic" : "review";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(publishTime)) return NextResponse.json({ error: "Choose a valid time." }, { status: 400 });
    const { data, error } = await supabase.from("postcraft_schedules").upsert({ user_id: user.id, enabled, publish_time: publishTime, timezone, mode, updated_at: new Date().toISOString() }, { onConflict: "user_id" }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ schedule: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save schedule." }, { status: 500 });
  }
}
