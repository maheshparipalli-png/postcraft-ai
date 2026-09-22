import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const access = await getAdminAccess();
  if (!access.authenticated) redirect("/login?next=/admin");
  if (!access.allowed) redirect("/");

  const admin = createAdminClient();
  const [{ count: users }, { count: activeTrials }, { count: paidUsers }, { count: expiredTrials }] =
    await Promise.all([
      admin.from("profiles").select("*", { count: "exact", head: true }),
      admin.from("billing_subscriptions").select("*", { count: "exact", head: true }).in("status", ["trialing", "grace"]),
      admin.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
      admin.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "expired"),
    ]);

  const { data: recentUsers } = await admin
    .from("profiles")
    .select("user_id,display_name,role,created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-6 border-b border-neutral-300 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">PostCraft administration</div>
            <h1 className="mt-3 font-serif text-5xl tracking-[-0.04em]">Admin dashboard</h1>
            <p className="mt-3 text-sm text-neutral-600">Signed in as {access.user?.email ?? "administrator"} · {access.role}</p>
          </div>
          <Link href="/admin/users" className="border-b border-neutral-900 pb-1 text-sm font-medium">Manage users →</Link>
        </div>

        <section className="grid gap-px border border-neutral-300 bg-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Users", users ?? 0],
            ["Active trials", activeTrials ?? 0],
            ["Paid users", paidUsers ?? 0],
            ["Expired trials", expiredTrials ?? 0],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#f7f6f2] p-6">
              <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">{label}</div>
              <div className="mt-3 font-serif text-4xl">{value}</div>
            </div>
          ))}
        </section>

        <section className="mt-10 border-y border-neutral-300">
          <div className="flex items-center justify-between border-b border-neutral-300 py-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Recent registrations</div>
              <h2 className="mt-2 font-serif text-2xl">Latest users</h2>
            </div>
            <Link href="/admin/users" className="text-xs underline underline-offset-4">View all</Link>
          </div>
          <div className="divide-y divide-neutral-300">
            {(recentUsers ?? []).map((user) => (
              <Link key={user.user_id} href={`/admin/users/${user.user_id}`} className="flex flex-col gap-2 py-5 transition hover:bg-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                <div>
                  <div className="font-medium">{user.display_name || "Unnamed user"}</div>
                  <div className="mt-1 text-xs text-neutral-500">{user.user_id}</div>
                </div>
                <div className="text-xs text-neutral-500">{user.role} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(user.created_at))}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
