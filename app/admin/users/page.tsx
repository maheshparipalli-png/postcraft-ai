import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

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
    .select("user_id,display_name,role,created_at,updated_at")
    .order("created_at", { ascending: false });

  const userIds = (profiles ?? []).map((p) => p.user_id);
  const { data: subscriptions } = userIds.length
    ? await admin.from("billing_subscriptions").select("user_id,status,trial_started_at,trial_ends_at,grace_ends_at,plan_key,trial_reset_count").in("user_id", userIds)
    : { data: [] };

  const byUser = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex items-end justify-between border-b border-neutral-300 pb-7">
          <div>
            <Link href="/admin" className="text-xs text-neutral-500 underline underline-offset-4">← Admin dashboard</Link>
            <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Users</h1>
          </div>
        </div>
        <div className="mt-8 overflow-x-auto border-y border-neutral-300">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-neutral-300 text-[10px] uppercase tracking-[0.16em] text-neutral-500">
              <tr><th className="px-3 py-4">User</th><th className="px-3 py-4">Role</th><th className="px-3 py-4">Status</th><th className="px-3 py-4">Trial ends</th><th className="px-3 py-4">Resets</th><th className="px-3 py-4"></th></tr>
            </thead>
            <tbody className="divide-y divide-neutral-300">
              {(profiles ?? []).map((profile) => {
                const subscription = byUser.get(profile.user_id);
                return (
                  <tr key={profile.user_id} className="hover:bg-white/50">
                    <td className="px-3 py-5"><div className="font-medium">{profile.display_name || "Unnamed user"}</div><div className="mt-1 text-xs text-neutral-500">{emailByUser.get(profile.user_id) || "No email"}</div><div className="mt-1 font-mono text-[10px] text-neutral-400">{profile.user_id}</div></td>
                    <td className="px-3 py-5 text-xs">{profile.role}</td>
                    <td className="px-3 py-5 text-xs">{subscription?.status ?? "not started"}</td>
                    <td className="px-3 py-5 text-xs">{subscription?.trial_ends_at ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(subscription.trial_ends_at)) : "—"}</td>
                    <td className="px-3 py-5 text-xs">{subscription?.trial_reset_count ?? 0}</td>
                    <td className="px-3 py-5 text-right"><Link href={`/admin/users/${profile.user_id}`} className="text-xs font-medium underline underline-offset-4">Manage →</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
