import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();
  const [{ data: profile, error: profileError }, { data: subscription }, { data: audit }] = await Promise.all([
    admin.from("profiles").select("user_id,display_name,role,created_at").eq("user_id", id).maybeSingle(),
    admin.from("billing_subscriptions").select("status,plan_key,trial_started_at,trial_ends_at,grace_ends_at,trial_reset_count,last_trial_reset_reason").eq("user_id", id).maybeSingle(),
    admin.from("admin_audit_logs").select("id,action,reason,created_at").eq("target_user_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({ profile, subscription, audit: audit ?? [] });
}
