import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdminAccess } from "@/lib/admin/access";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default async function AdminDashboardPage() {
  const access = await getAdminAccess();
  if (!access.authenticated) redirect("/login?next=/admin");
  if (!access.allowed) redirect("/");

  const admin = createAdminClient();
  const [
    usersResult, trialResult, paidResult, expiredResult, pastDueResult,
    schedulesResult, publicationsResult, draftsResult, commentsResult,
    recentUsersResult, recentAuditResult,
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("billing_subscriptions").select("*", { count: "exact", head: true }).in("status", ["trialing", "grace"]),
    admin.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "active"),
    admin.from("billing_subscriptions").select("*", { count: "exact", head: true }).eq("status", "expired"),
    admin.from("billing_subscriptions").select("*", { count: "exact", head: true }).in("status", ["past_due", "suspended"]),
    admin.from("postcraft_schedules").select("*", { count: "exact", head: true }).eq("enabled", true),
    admin.from("postcraft_publications").select("*", { count: "exact", head: true }),
    admin.from("postcraft_daily_drafts").select("*", { count: "exact", head: true }),
    admin.from("commentcraft_comments").select("*", { count: "exact", head: true }),
    admin.from("profiles").select("user_id,display_name,role,created_at").order("created_at", { ascending: false }).limit(8),
    admin.from("admin_audit_logs").select("id,action,target_user_id,reason,created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const metricCards = [
    ["Total users", usersResult.count ?? 0],
    ["Trial / grace", trialResult.count ?? 0],
    ["Paid users", paidResult.count ?? 0],
    ["Past due / suspended", pastDueResult.count ?? 0],
  ];

  const activityCards = [
    ["Scheduled users", schedulesResult.count ?? 0, "Automation enabled"],
    ["Publications", publicationsResult.count ?? 0, "LinkedIn history"],
    ["Daily drafts", draftsResult.count ?? 0, "Generated content"],
    ["Comments", commentsResult.count ?? 0, "CommentCraft"],
  ];

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-10">
        <header className="flex flex-col gap-6 border-b border-neutral-300 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">PostCraft AI · administration</div>
            <h1 className="mt-3 font-serif text-5xl tracking-[-0.04em] sm:text-6xl">Control room</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">Operational view of users, subscriptions, automation and content activity.</p>
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="border border-neutral-300 bg-white/60 px-3 py-2">{access.role === "super_admin" ? "Super administrator" : "Administrator"}</span>
            <Link href="/admin/users" className="border border-neutral-900 bg-neutral-900 px-4 py-2 font-medium text-white">Manage users →</Link>
          </div>
        </header>

        <section className="mt-8 grid gap-px border border-neutral-300 bg-neutral-300 sm:grid-cols-2 lg:grid-cols-4">
          {metricCards.map(([label, value]) => (
            <div key={String(label)} className="bg-[#f7f6f2] p-6">
              <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">{label}</div>
              <div className="mt-3 font-serif text-4xl">{value}</div>
            </div>
          ))}
        </section>

        <section className="mt-10">
          <div className="mb-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Product activity</div>
            <h2 className="mt-2 font-serif text-2xl">What is happening inside PostCraft</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {activityCards.map(([label, value, note]) => (
              <Link key={String(label)} href="/admin/users" className="group border border-neutral-300 bg-white/60 p-5 transition hover:bg-white">
                <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">{label}</div>
                <div className="mt-3 font-serif text-3xl">{value}</div>
                <div className="mt-2 text-xs text-neutral-500">{note}</div>
                <div className="mt-5 text-xs underline underline-offset-4 opacity-0 transition group-hover:opacity-100">Inspect →</div>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="border-y border-neutral-300">
            <div className="flex items-center justify-between border-b border-neutral-300 py-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Accounts</div>
                <h2 className="mt-2 font-serif text-2xl">Recent registrations</h2>
              </div>
              <Link href="/admin/users" className="text-xs underline underline-offset-4">View all</Link>
            </div>
            <div className="divide-y divide-neutral-300">
              {(recentUsersResult.data ?? []).map((user) => (
                <Link key={user.user_id} href={`/admin/users/${user.user_id}`} className="flex flex-col gap-2 py-5 transition hover:bg-white/60 sm:flex-row sm:items-center sm:justify-between sm:px-2">
                  <div>
                    <div className="font-medium">{user.display_name || "Unnamed user"}</div>
                    <div className="mt-1 font-mono text-[10px] text-neutral-400">{user.user_id}</div>
                  </div>
                  <div className="text-xs text-neutral-500">{user.role} · {formatDate(user.created_at)}</div>
                </Link>
              ))}
              {!recentUsersResult.data?.length && <div className="py-8 text-sm text-neutral-500">No users found.</div>}
            </div>
          </div>

          <div className="border-y border-neutral-300">
            <div className="border-b border-neutral-300 py-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Admin activity</div>
              <h2 className="mt-2 font-serif text-2xl">Audit trail</h2>
            </div>
            <div className="divide-y divide-neutral-300">
              {(recentAuditResult.data ?? []).map((item) => (
                <div key={item.id} className="py-4">
                  <div className="text-sm font-medium">{item.action}</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-500">{item.reason || "No reason recorded"} · {formatDate(item.created_at)}</div>
                </div>
              ))}
              {!recentAuditResult.data?.length && <div className="py-8 text-sm text-neutral-500">No admin actions recorded.</div>}
            </div>
          </div>
        </section>

        <section className="mt-10 border border-neutral-300 bg-white/40 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Operations</div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Users", "/admin/users", "Accounts and billing"],
              ["Billing", "/admin/users", "Subscriptions and trials"],
              ["Automation", "/admin/users", "Schedules and content"],
              ["Audit log", "/admin", "Administrative actions"],
            ].map(([label, href, description]) => (
              <Link key={label} href={href} className="border border-neutral-300 p-4 transition hover:bg-white">
                <div className="font-medium">{label} →</div>
                <div className="mt-1 text-xs text-neutral-500">{description}</div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
