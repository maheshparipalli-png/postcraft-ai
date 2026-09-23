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

  const [{ data: profile, error: profileError }, { data: subscription }, { data: schedule }, { data: publications }, { data: drafts }, { data: comments }, { data: audit }] = await Promise.all([
    admin.from("profiles").select("user_id,display_name,role,created_at,updated_at").eq("user_id", id).maybeSingle(),
    admin.from("billing_subscriptions").select("status,plan_key,trial_started_at,trial_ends_at,grace_ends_at,current_period_start,current_period_end,razorpay_customer_id,razorpay_subscription_id,razorpay_payment_id,payment_verified_at,trial_reset_count,last_trial_reset_at,last_trial_reset_reason,updated_at").eq("user_id", id).maybeSingle(),
    admin.from("postcraft_schedules").select("enabled,publish_time,timezone,mode,created_at,updated_at").eq("user_id", id).maybeSingle(),
    admin.from("postcraft_publications").select("id,linkedin_post_id,source_title,source_url,published_at").eq("user_id", id).order("published_at", { ascending: false }).limit(20),
    admin.from("postcraft_daily_drafts").select("id,draft_date,status,source_title,verification_status,published_at,created_at").eq("user_id", id).order("draft_date", { ascending: false }).limit(20),
    admin.from("commentcraft_comments").select("id,status,preset,published_at,created_at,post_id").in("post_id", (await admin.from("commentcraft_posts").select("id").eq("user_id", id)).data?.map((post) => post.id) ?? []).order("created_at", { ascending: false }).limit(20),
    admin.from("admin_audit_logs").select("id,admin_user_id,action,reason,metadata,created_at").eq("target_user_id", id).order("created_at", { ascending: false }).limit(50),
  ]);

  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const authUser = await admin.auth.admin.getUserById(id);
  const commentPostIds = new Set((await admin.from("commentcraft_posts").select("id").eq("user_id", id)).data?.map((post) => post.id) ?? []);
  const userComments = (comments ?? []).filter((comment) => commentPostIds.has(comment.post_id));

  return NextResponse.json({
    profile,
    email: authUser.data.user?.email ?? "",
    emailConfirmedAt: authUser.data.user?.email_confirmed_at ?? null,
    lastSignInAt: authUser.data.user?.last_sign_in_at ?? null,
    subscription,
    schedule,
    publications: publications ?? [],
    drafts: drafts ?? [],
    comments: userComments,
    audit: audit ?? [],
  });
}
