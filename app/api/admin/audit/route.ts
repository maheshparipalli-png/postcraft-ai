import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await getAdminAccess();
  if (!access.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!access.allowed) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const url = new URL(request.url);
  const action = url.searchParams.get("action")?.trim() || "";
  const targetUserId = url.searchParams.get("target_user_id")?.trim() || "";
  const adminUserId = url.searchParams.get("admin_user_id")?.trim() || "";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") || 100), 1), 200);

  const admin = createAdminClient();
  let query = admin.from("admin_audit_logs")
    .select("id,admin_user_id,target_user_id,action,reason,metadata,created_at")
    .order("created_at", { ascending: false }).limit(limit);

  if (action) query = query.eq("action", action);
  if (targetUserId) query = query.eq("target_user_id", targetUserId);
  if (adminUserId) query = query.eq("admin_user_id", adminUserId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = Array.from(new Set((data ?? []).flatMap((item) => [item.admin_user_id, item.target_user_id]).filter(Boolean)));
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("user_id,display_name,role").in("user_id", ids)
    : { data: [] };
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));

  const authUsers = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map((authUsers.data.users ?? []).map((user) => [user.id, user.email ?? ""]));

  return NextResponse.json({
    logs: (data ?? []).map((item) => ({
      ...item,
      admin: { display_name: profileById.get(item.admin_user_id)?.display_name ?? null, email: emailById.get(item.admin_user_id) ?? "" },
      target: item.target_user_id ? { display_name: profileById.get(item.target_user_id)?.display_name ?? null, email: emailById.get(item.target_user_id) ?? "" } : null,
    })),
  });
}
