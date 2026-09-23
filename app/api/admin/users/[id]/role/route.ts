import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await getAdminAccess();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (access.role !== "super_admin") return NextResponse.json({ error: "Super admin access required." }, { status: 403 });

  const { id } = await params;
  if (id === access.user!.id) return NextResponse.json({ error: "You cannot change your own admin role." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const role = body?.role;
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 500) : "";

  if (!["user", "admin", "super_admin"].includes(role)) {
    return NextResponse.json({ error: "Invalid role." }, { status: 400 });
  }
  if (!reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });

  const admin = createAdminClient();
  const { data: target, error: targetError } = await admin.from("profiles").select("role,display_name").eq("user_id", id).maybeSingle();
  if (targetError) return NextResponse.json({ error: targetError.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  if (target.role === role) return NextResponse.json({ error: "User already has that role." }, { status: 409 });

  if (target.role === "super_admin" && role !== "super_admin") {
    const { count, error: countError } = await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", "super_admin");
    if (countError) return NextResponse.json({ error: countError.message }, { status: 500 });
    if ((count ?? 0) <= 1) return NextResponse.json({ error: "The last super admin cannot be demoted." }, { status: 409 });
  }

  const { error } = await admin.from("profiles").update({ role }).eq("user_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await admin.from("admin_audit_logs").insert({
    admin_user_id: access.user!.id,
    target_user_id: id,
    action: "role_changed",
    reason,
    metadata: { previous_role: target.role, new_role: role },
  });

  return NextResponse.json({ ok: true, previousRole: target.role, role });
}
