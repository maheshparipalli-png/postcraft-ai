"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Data = {
  profile: { user_id: string; display_name: string | null; role: string; created_at: string } | null;
  subscription: {
    status: string;
    plan_key: string;
    trial_started_at: string | null;
    trial_ends_at: string | null;
    grace_ends_at: string | null;
    trial_reset_count: number;
    last_trial_reset_reason: string | null;
  } | null;
  audit: { id: string; action: string; reason: string | null; created_at: string }[];
};

export default function AdminUserPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [days, setDays] = useState("15");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${params.id}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load user.");
      setData(json);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load user.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [params.id]);

  async function resetTrial() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${params.id}/trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days), reason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not reset trial.");
      setReason("");
      setMessage(`Trial reset to ${days} days.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset trial.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-[#f7f6f2] p-10 text-sm text-neutral-500">Loading user…</main>;

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        <Link href="/admin/users" className="text-xs text-neutral-500 underline underline-offset-4">← Users</Link>
        <h1 className="mt-5 font-serif text-5xl tracking-[-0.04em]">{data?.profile?.display_name || "User"}</h1>
        <p className="mt-2 font-mono text-xs text-neutral-500">{params.id}</p>

        {message && <div className="mt-6 border border-neutral-300 bg-white px-4 py-3 text-sm">{message}</div>}

        <section className="mt-10 grid gap-6 sm:grid-cols-2">
          <div className="border border-neutral-300 bg-white/60 p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Account</div>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-neutral-500">Role</dt><dd className="font-medium">{data?.profile?.role}</dd></div>
              <div><dt className="text-neutral-500">Created</dt><dd>{data?.profile?.created_at ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(data.profile.created_at)) : "—"}</dd></div>
              <div><dt className="text-neutral-500">User ID</dt><dd className="break-all font-mono text-xs">{params.id}</dd></div>
            </dl>
          </div>
          <div className="border border-neutral-300 bg-white/60 p-6">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Billing</div>
            <dl className="mt-5 space-y-3 text-sm">
              <div><dt className="text-neutral-500">Status</dt><dd className="font-medium">{data?.subscription?.status ?? "not started"}</dd></div>
              <div><dt className="text-neutral-500">Trial ends</dt><dd>{data?.subscription?.trial_ends_at ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(data.subscription.trial_ends_at)) : "—"}</dd></div>
              <div><dt className="text-neutral-500">Grace ends</dt><dd>{data?.subscription?.grace_ends_at ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(data.subscription.grace_ends_at)) : "—"}</dd></div>
              <div><dt className="text-neutral-500">Trial resets</dt><dd>{data?.subscription?.trial_reset_count ?? 0}</dd></div>
            </dl>
          </div>
        </section>

        <section className="mt-8 border border-neutral-300 bg-white/60 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Admin action</div>
          <h2 className="mt-2 font-serif text-2xl">Reset or extend trial</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">This starts a fresh trial window and records the action in the admin audit log.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-[140px_1fr_auto]">
            <label className="text-sm">Days<input value={days} onChange={(e) => setDays(e.target.value)} type="number" min={1} max={365} className="mt-2 w-full border border-neutral-300 bg-transparent px-3 py-2" /></label>
            <label className="text-sm">Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer support extension" className="mt-2 w-full border border-neutral-300 bg-transparent px-3 py-2" /></label>
            <button type="button" onClick={resetTrial} disabled={saving || !reason.trim()} className="self-end border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Apply trial"}</button>
          </div>
        </section>

        <section className="mt-8 border-y border-neutral-300">
          <div className="py-5"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Audit trail</div></div>
          <div className="divide-y divide-neutral-300">
            {data?.audit?.length ? data.audit.map((item) => <div key={item.id} className="py-4 text-sm"><div className="font-medium">{item.action}</div><div className="mt-1 text-xs text-neutral-500">{item.reason || "No reason recorded"} · {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.created_at))}</div></div>) : <div className="py-8 text-sm text-neutral-500">No admin actions recorded.</div>}
          </div>
        </section>
      </div>
    </main>
  );
}
