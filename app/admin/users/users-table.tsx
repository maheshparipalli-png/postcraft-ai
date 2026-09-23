"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type AdminUserRow = {
  user_id: string;
  display_name: string | null;
  role: string;
  created_at: string;
  email: string;
  status: string;
  trial_ends_at: string | null;
  trial_reset_count: number;
  plan_key: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export default function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [role, setRole] = useState("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery = !needle || user.email.toLowerCase().includes(needle) || (user.display_name ?? "").toLowerCase().includes(needle) || user.user_id.toLowerCase().includes(needle);
      return matchesQuery && (status === "all" || user.status === status) && (role === "all" || user.role === role);
    });
  }, [users, query, status, role]);

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <div className="flex flex-col gap-5 border-b border-neutral-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="text-xs text-neutral-500 underline underline-offset-4">← Admin dashboard</Link>
            <h1 className="mt-4 font-serif text-5xl tracking-[-0.04em]">Users</h1>
            <p className="mt-2 text-sm text-neutral-500">{users.length} registered accounts · {filtered.length} shown</p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="border border-neutral-300 bg-white/60 px-4 py-3"><div className="text-lg font-medium">{users.filter((u) => u.status === "active").length}</div><div className="text-neutral-500">Paid</div></div>
            <div className="border border-neutral-300 bg-white/60 px-4 py-3"><div className="text-lg font-medium">{users.filter((u) => u.status === "trialing" || u.status === "grace").length}</div><div className="text-neutral-500">Trial</div></div>
            <div className="border border-neutral-300 bg-white/60 px-4 py-3"><div className="text-lg font-medium">{users.filter((u) => ["past_due", "suspended"].includes(u.status)).length}</div><div className="text-neutral-500">Attention</div></div>
          </div>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_180px_160px]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, email or user ID…" className="border border-neutral-300 bg-white/70 px-4 py-3 text-sm outline-none focus:border-neutral-700" />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-neutral-300 bg-white/70 px-3 py-3 text-sm"><option value="all">All statuses</option><option value="not_started">Not started</option><option value="trialing">Trialing</option><option value="grace">Grace</option><option value="active">Active</option><option value="past_due">Past due</option><option value="suspended">Suspended</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border border-neutral-300 bg-white/70 px-3 py-3 text-sm"><option value="all">All roles</option><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select>
        </div>
        <div className="mt-7 overflow-x-auto border-y border-neutral-300">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="border-b border-neutral-300 text-[10px] uppercase tracking-[0.16em] text-neutral-500"><tr><th className="px-3 py-4">User</th><th className="px-3 py-4">Role</th><th className="px-3 py-4">Status</th><th className="px-3 py-4">Trial ends</th><th className="px-3 py-4">Resets</th><th className="px-3 py-4"></th></tr></thead>
            <tbody className="divide-y divide-neutral-300">
              {filtered.map((user) => <tr key={user.user_id} className="hover:bg-white/50"><td className="px-3 py-5"><div className="font-medium">{user.display_name || "Unnamed user"}</div><div className="mt-1 text-xs text-neutral-500">{user.email || "No email"}</div><div className="mt-1 font-mono text-[10px] text-neutral-400">{user.user_id}</div></td><td className="px-3 py-5 text-xs">{user.role}</td><td className="px-3 py-5"><span className="rounded-full border border-neutral-300 px-2 py-1 text-[11px]">{user.status}</span></td><td className="px-3 py-5 text-xs">{formatDate(user.trial_ends_at)}</td><td className="px-3 py-5 text-xs">{user.trial_reset_count}</td><td className="px-3 py-5 text-right"><Link href={`/admin/users/${user.user_id}`} className="text-xs font-medium underline underline-offset-4">Manage →</Link></td></tr>)}
              {!filtered.length && <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-neutral-500">No users match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
