"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Log = {
  id: string; admin_user_id: string; target_user_id: string | null; action: string; reason: string | null;
  metadata: Record<string, unknown> | null; created_at: string;
  admin: { display_name: string | null; email: string };
  target: { display_name: string | null; email: string } | null;
};

function date(value: string) {
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function AdminAuditPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [action, setAction] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (action !== "all") params.set("action", action);
    fetch(`/api/admin/audit?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json.error || "Could not load audit log.");
        setLogs(json.logs ?? []);
      })
      .catch((error) => { if (error.name !== "AbortError") setLogs([]); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [action]);

  const actions = useMemo(() => Array.from(new Set(logs.map((log) => log.action))).sort(), [logs]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return logs;
    return logs.filter((log) => [log.action, log.reason ?? "", log.admin.email, log.admin.display_name ?? "", log.target?.email ?? "", log.target?.display_name ?? "", log.target_user_id ?? ""].join(" ").toLowerCase().includes(needle));
  }, [logs, query]);

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
        <Link href="/admin" className="text-xs text-neutral-500 underline underline-offset-4">← Admin dashboard</Link>
        <div className="mt-5 border-b border-neutral-300 pb-7">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Administration</div>
          <h1 className="mt-2 font-serif text-5xl tracking-[-0.04em]">Audit log</h1>
          <p className="mt-2 text-sm text-neutral-500">A chronological record of privileged administrative actions.</p>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-[1fr_220px]">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search action, admin, user or reason…" className="border border-neutral-300 bg-white/70 px-4 py-3 text-sm outline-none focus:border-neutral-700" />
          <select value={action} onChange={(e) => setAction(e.target.value)} className="border border-neutral-300 bg-white/70 px-3 py-3 text-sm">
            <option value="all">All actions</option>
            {actions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>

        <div className="mt-7 overflow-x-auto border-y border-neutral-300">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-neutral-300 text-[10px] uppercase tracking-[0.16em] text-neutral-500"><tr><th className="px-3 py-4">Time</th><th className="px-3 py-4">Action</th><th className="px-3 py-4">Admin</th><th className="px-3 py-4">Target</th><th className="px-3 py-4">Reason</th></tr></thead>
            <tbody className="divide-y divide-neutral-300">
              {loading ? <tr><td colSpan={5} className="px-3 py-12 text-center text-neutral-500">Loading audit log…</td></tr> :
                filtered.map((log) => <tr key={log.id} className="hover:bg-white/50">
                  <td className="whitespace-nowrap px-3 py-5 text-xs text-neutral-500">{date(log.created_at)}</td>
                  <td className="px-3 py-5"><span className="rounded-full border border-neutral-300 px-2 py-1 text-[11px]">{log.action}</span></td>
                  <td className="px-3 py-5"><div className="font-medium">{log.admin.display_name || "Administrator"}</div><div className="text-xs text-neutral-500">{log.admin.email}</div></td>
                  <td className="px-3 py-5"><div className="font-medium">{log.target?.display_name || "System / unknown"}</div><div className="text-xs text-neutral-500">{log.target?.email || log.target_user_id || "—"}</div></td>
                  <td className="max-w-md px-3 py-5 text-xs leading-5 text-neutral-600">{log.reason || "No reason recorded"}</td>
                </tr>)
              }
              {!loading && !filtered.length && <tr><td colSpan={5} className="px-3 py-12 text-center text-neutral-500">No audit entries match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
