import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";
import AdminUsersTable, { type AdminUserRow } from "./users-table";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const access = await getAdminAccess();
  if (!access.authenticated) redirect("/login?next=/admin/users");
  if (!access.allowed) redirect("/");

  const admin = createAdminClient();
  const { data: authUsers } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailByUser = new Map((authUsers?.users ?? []).map((user) => [user.id, user.email ?? ""]));

  const { data: profiles } = await admin
    .from("profiles")
    .select("user_id,display_name,role,created_at")
    .order("created_at", { ascending: false });

  const userIds = (profiles ?? []).map((profile) => profile.user_id);
  const { data: subscriptions } = userIds.length
    ? await admin.from("billing_subscriptions").select("user_id,status,trial_ends_at,trial_reset_count,plan_key").in("user_id", userIds)
    : { data: [] };

  const byUser = new Map((subscriptions ?? []).map((subscription) => [subscription.user_id, subscription]));

  const users: AdminUserRow[] = (profiles ?? []).map((profile) => {
    const subscription = byUser.get(profile.user_id);
    return {
      user_id: profile.user_id,
      display_name: profile.display_name,
      role: profile.role,
      created_at: profile.created_at,
      email: emailByUser.get(profile.user_id) ?? "",
      status: subscription?.status ?? "not_started",
      trial_ends_at: subscription?.trial_ends_at ?? null,
      trial_reset_count: subscription?.trial_reset_count ?? 0,
      plan_key: subscription?.plan_key ?? null,
    };
  });

  return <AdminUsersTable users={users} />;
}
