import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const { id } = await params;
  if (id === access.user!.id) return NextResponse.json({ error: "You cannot suspend your own account." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const status = body?.status;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (!["active", "suspended"].includes(status)) {
    return NextResponse.json({ error: "Invalid account status." }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("role,account_status,display_name")
    .eq("user_id", id)
    .maybeSingle();

  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (target.account_status === status) {
    return NextResponse.json({ error: `Account is already ${status}.` }, { status: 409 });
  }

  if (target.role === "super_admin") {
    return NextResponse.json({ error: "Super admin accounts cannot be suspended from this control." }, { status: 403 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ account_status: status })
    .eq("user_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_logs").insert({
    admin_user_id: access.user!.id,
    target_user_id: id,
    action: status === "suspended" ? "account_suspended" : "account_reactivated",
    reason,
    metadata: { previous_status: target.account_status, new_status: status },
  });

  return NextResponse.json({ ok: true, previousStatus: target.account_status, status });
}
