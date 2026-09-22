import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccess } from "@/lib/billing/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireBillingAccess() {
  const billing = await getBillingAccess();
  if (!billing.authenticated) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  if (!billing.allowed) return NextResponse.json({
    error: billing.status === "expired" ? "Your free trial has expired. Subscribe to continue." : "Start your free trial or subscribe to continue.",
    status: billing.status,
  }, { status: 402 });
  return null;
}

function isValidTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && minute % 15 === 0;
}

function isValidTimezone(value: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: value }).format(); return true; }
  catch { return false; }
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
    console.error("Could not load auto-publish schedule:", error);
    return NextResponse.json({ error: "Could not load schedule." }, { status: 500 });
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
    const enabled = body.enabled === true;
    const publishTime = typeof body.publishTime === "string" ? body.publishTime.trim() : "08:00";
    const timezone = typeof body.timezone === "string" ? body.timezone.trim() : "Asia/Kolkata";
    const mode = body.mode === "automatic" ? "automatic" : "review";

    if (!isValidTime(publishTime)) return NextResponse.json({ error: "Choose a time on a 15-minute interval (for example 08:00, 08:15, or 08:30)." }, { status: 400 });
    if (!isValidTimezone(timezone)) return NextResponse.json({ error: "Choose a valid timezone." }, { status: 400 });

    const { data, error } = await supabase.from("postcraft_schedules").upsert({
      user_id: user.id,
      enabled,
      publish_time: publishTime,
      timezone,
      mode,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" }).select("*").single();

    if (error) throw error;
    return NextResponse.json({ schedule: data });
  } catch (error) {
    console.error("Could not save auto-publish schedule:", error);
    return NextResponse.json({ error: "Could not save schedule." }, { status: 500 });
  }
}
