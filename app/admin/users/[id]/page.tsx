"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Data = {
  profile: { user_id: string; display_name: string | null; role: string; account_status: "active" | "suspended"; created_at: string; updated_at: string } | null;
  email: string;
  emailConfirmedAt: string | null;
  lastSignInAt: string | null;
  subscription: {
    status: string; plan_key: string; trial_started_at: string | null; trial_ends_at: string | null; grace_ends_at: string | null;
    current_period_start: string | null; current_period_end: string | null; razorpay_customer_id: string | null;
    razorpay_subscription_id: string | null; razorpay_payment_id: string | null; payment_verified_at: string | null;
    trial_reset_count: number; last_trial_reset_at: string | null; last_trial_reset_reason: string | null;
  } | null;
  schedule: { enabled: boolean; publish_time: string; timezone: string; mode: string; updated_at: string } | null;
  publications: { id: string; linkedin_post_id: string | null; source_title: string | null; source_url: string | null; published_at: string }[];
  drafts: { id: string; draft_date: string; status: string; source_title: string | null; verification_status: string | null; published_at: string | null; created_at: string }[];
  comments: { id: string; status: string; preset: string | null; published_at: string | null; created_at: string }[];
  audit: { id: string; admin_user_id: string; action: string; reason: string | null; metadata: Record<string, unknown> | null; created_at: string }[];
};

function date(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}

export default function AdminUserPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Data | null>(null);
  const [days, setDays] = useState("15");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");
  const [roleReason, setRoleReason] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  const [accountReason, setAccountReason] = useState("");
  const [accountSaving, setAccountSaving] = useState(false);

  const loadUser = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/users/${userId}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not load user.");
      setData(json);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load user.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadUser(params.id); }, [loadUser, params.id]);

  async function changeAccountStatus(status: "active" | "suspended") {
    if (!accountReason.trim()) return;
    setAccountSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${params.id}/account`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: accountReason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not update account status.");
      setAccountReason("");
      setMessage(status === "suspended" ? "Account suspended." : "Account reactivated.");
      await loadUser(params.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update account status.");
    } finally { setAccountSaving(false); }
  }

  async function changeRole() {
    if (!role || !roleReason.trim()) return;
    setRoleSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${params.id}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, reason: roleReason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not change role.");
      setRole(""); setRoleReason("");
      setMessage(`Role changed from ${json.previousRole} to ${json.role}.`);
      await loadUser(params.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not change role.");
    } finally { setRoleSaving(false); }
  }

  async function resetTrial() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/users/${params.id}/trial`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days: Number(days), reason }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Could not reset trial.");
      setReason(""); setMessage(`Trial reset to ${days} days.`); await loadUser(params.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not reset trial.");
    } finally { setSaving(false); }
  }

  if (loading) return <main className="min-h-screen bg-[#f7f6f2] p-10 text-sm text-neutral-500">Loading user…</main>;
  if (!data?.profile) return <main className="min-h-screen bg-[#f7f6f2] p-10 text-sm">User not found.</main>;

  const s = data.subscription;

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <Link href="/admin/users" className="text-xs text-neutral-500 underline underline-offset-4">← Users</Link>
        <div className="mt-5 flex flex-col gap-3 border-b border-neutral-300 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div><h1 className="font-serif text-5xl tracking-[-0.04em]">{data.profile.display_name || "User"}</h1><p className="mt-2 text-sm text-neutral-500">{data.email || "No email"} · <span className="font-mono text-xs">{params.id}</span></p></div>
          <span className="rounded-full border border-neutral-400 px-3 py-1 text-xs">{data.profile.role}</span>
        </div>

        {message && <div className="mt-6 border border-neutral-300 bg-white px-4 py-3 text-sm">{message}</div>}

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="border border-neutral-300 bg-white/60 p-6"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Account</div><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-neutral-500">Email</dt><dd>{data.email || "—"}</dd></div><div><dt className="text-neutral-500">Email confirmed</dt><dd>{date(data.emailConfirmedAt, true)}</dd></div><div><dt className="text-neutral-500">Last sign-in</dt><dd>{date(data.lastSignInAt, true)}</dd></div><div><dt className="text-neutral-500">Created</dt><dd>{date(data.profile.created_at)}</dd></div></dl></div>
          <div className="border border-neutral-300 bg-white/60 p-6"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Billing</div><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-neutral-500">Status</dt><dd className="font-medium">{s?.status ?? "not started"}</dd></div><div><dt className="text-neutral-500">Plan</dt><dd>{s?.plan_key ?? "—"}</dd></div><div><dt className="text-neutral-500">Trial ends</dt><dd>{date(s?.trial_ends_at)}</dd></div><div><dt className="text-neutral-500">Paid period</dt><dd>{date(s?.current_period_start)} → {date(s?.current_period_end)}</dd></div></dl></div>
          <div className="border border-neutral-300 bg-white/60 p-6"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Automation</div><dl className="mt-5 space-y-3 text-sm"><div><dt className="text-neutral-500">Schedule</dt><dd>{data.schedule?.enabled ? "Enabled" : "Disabled"}</dd></div><div><dt className="text-neutral-500">Publish time</dt><dd>{data.schedule ? `${data.schedule.publish_time} · ${data.schedule.timezone}` : "—"}</dd></div><div><dt className="text-neutral-500">Mode</dt><dd>{data.schedule?.mode ?? "—"}</dd></div><div><dt className="text-neutral-500">Publications</dt><dd>{data.publications.length}</dd></div></dl></div>
        </section>

        <section className="mt-8 border border-neutral-300 bg-white/60 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Account access</div>
          <h2 className="mt-2 font-serif text-2xl">Account status</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Suspension blocks application and API access while preserving billing records and customer data.</p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1 text-sm">Reason<input value={accountReason} onChange={(e) => setAccountReason(e.target.value)} placeholder="e.g. Abuse investigation" className="mt-2 w-full border border-neutral-300 bg-transparent px-3 py-2" /></label>
            {data.profile.account_status === "active" ? <button type="button" onClick={() => changeAccountStatus("suspended")} disabled={accountSaving || !accountReason.trim()} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{accountSaving ? "Saving…" : "Suspend account"}</button> : <button type="button" onClick={() => changeAccountStatus("active")} disabled={accountSaving || !accountReason.trim()} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{accountSaving ? "Saving…" : "Reactivate account"}</button>}
          </div>
        </section>

        <section className="mt-8 border border-neutral-300 bg-white/60 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Super admin action</div>
          <h2 className="mt-2 font-serif text-2xl">Change role</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Role changes require super admin authorization and are recorded in the audit trail.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-[180px_1fr_auto]">
            <label className="text-sm">New role<select value={role} onChange={(e) => setRole(e.target.value)} className="mt-2 w-full border border-neutral-300 bg-white px-3 py-2"><option value="">Select…</option><option value="user">User</option><option value="admin">Admin</option><option value="super_admin">Super admin</option></select></label>
            <label className="text-sm">Reason<input value={roleReason} onChange={(e) => setRoleReason(e.target.value)} placeholder="e.g. Promote support operator" className="mt-2 w-full border border-neutral-300 bg-transparent px-3 py-2" /></label>
            <button type="button" onClick={changeRole} disabled={roleSaving || !role || !roleReason.trim()} className="self-end border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{roleSaving ? "Saving…" : "Change role"}</button>
          </div>
        </section>

        <section className="mt-8 border border-neutral-300 bg-white/60 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Razorpay</div>
          <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
            <div><div className="text-neutral-500">Customer ID</div><div className="mt-1 break-all font-mono text-xs">{s?.razorpay_customer_id ?? "—"}</div></div>
            <div><div className="text-neutral-500">Subscription ID</div><div className="mt-1 break-all font-mono text-xs">{s?.razorpay_subscription_id ?? "—"}</div></div>
            <div><div className="text-neutral-500">Payment ID</div><div className="mt-1 break-all font-mono text-xs">{s?.razorpay_payment_id ?? "—"}</div></div>
            <div><div className="text-neutral-500">Payment verified</div><div className="mt-1">{date(s?.payment_verified_at, true)}</div></div>
          </div>
        </section>

        <section className="mt-8 border border-neutral-300 bg-white/60 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Admin action</div>
          <h2 className="mt-2 font-serif text-2xl">Reset or extend trial</h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">Starts a fresh trial window and records the action in the audit log.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-[140px_1fr_auto]">
            <label className="text-sm">Days<input value={days} onChange={(e) => setDays(e.target.value)} type="number" min={1} max={365} className="mt-2 w-full border border-neutral-300 bg-transparent px-3 py-2" /></label>
            <label className="text-sm">Reason<input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Customer support extension" className="mt-2 w-full border border-neutral-300 bg-transparent px-3 py-2" /></label>
            <button type="button" onClick={resetTrial} disabled={saving || !reason.trim()} className="self-end border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Apply trial"}</button>
          </div>
        </section>

        <section className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="border-y border-neutral-300"><div className="py-5"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Recent publications</div></div><div className="divide-y divide-neutral-300">{data.publications.length ? data.publications.slice(0, 10).map((item) => <div key={item.id} className="py-4 text-sm"><div className="font-medium">{item.source_title || "LinkedIn publication"}</div><div className="mt-1 text-xs text-neutral-500">{date(item.published_at, true)} · {item.linkedin_post_id || "No post ID"}</div></div>) : <div className="py-8 text-sm text-neutral-500">No publications recorded.</div>}</div></div>
          <div className="border-y border-neutral-300"><div className="py-5"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Recent drafts</div></div><div className="divide-y divide-neutral-300">{data.drafts.length ? data.drafts.slice(0, 10).map((item) => <div key={item.id} className="py-4 text-sm"><div className="font-medium">{item.source_title || "Untitled draft"}</div><div className="mt-1 text-xs text-neutral-500">{item.draft_date} · {item.status} · {item.verification_status || "unverified"}</div></div>) : <div className="py-8 text-sm text-neutral-500">No drafts recorded.</div>}</div></div>
        </section>

        <section className="mt-8 border-y border-neutral-300"><div className="py-5"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Audit trail</div></div><div className="divide-y divide-neutral-300">{data.audit.length ? data.audit.map((item) => <div key={item.id} className="py-4 text-sm"><div className="font-medium">{item.action}</div><div className="mt-1 text-xs text-neutral-500">{item.reason || "No reason recorded"} · {date(item.created_at, true)}</div></div>) : <div className="py-8 text-sm text-neutral-500">No admin actions recorded.</div>}</div></section>
      </div>
    </main>
  );
}
