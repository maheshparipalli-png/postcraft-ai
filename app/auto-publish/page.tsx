"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Schedule = {
  enabled: boolean;
  publish_time: string;
  timezone: string;
  mode: "review" | "automatic";
};

const nav = [["Home", "/"], ["Write", "/create"], ["Auto-post", "/auto-post"], ["Auto-publish", "/auto-publish"], ["CommentCraft", "/commentcraft/import"], ["Workspace", "/workspace"], ["Billing", "/billing"]];

export default function AutoPublishPage() {
  const [enabled, setEnabled] = useState(false);
  const [time, setTime] = useState("08:00");
  const [mode, setMode] = useState<"review" | "automatic">("review");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/auto-publish/schedule", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Could not load automation settings.");
        if (data?.schedule) {
          const schedule = data.schedule as Schedule;
          setEnabled(Boolean(schedule.enabled));
          setTime(schedule.publish_time || "08:00");
          setMode(schedule.mode === "automatic" ? "automatic" : "review");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load automation settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const response = await fetch("/api/auto-publish/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, publishTime: time, timezone: "Asia/Kolkata", mode }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not save automation settings.");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save automation settings.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="min-h-screen bg-[#f4f3ef] text-[#171717]"><div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
    <header className="flex flex-col gap-5 border-b border-neutral-300/80 py-5 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/" className="flex items-center gap-3"><span className="font-serif text-2xl font-semibold tracking-[-0.04em]">POSTCRAFT</span><span className="hidden border-l border-neutral-300 pl-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">AI editorial automation</span></Link>
      <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Main navigation">{nav.map(([label, href]) => <Link key={href} href={href} className={label === "Auto-publish" ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}>{label}</Link>)}</nav>
    </header>

    <section className="border-b border-neutral-300/80 py-12 lg:py-16"><div className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Manage · Recurring automation</div><h1 className="max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-7xl">Control how your<br />daily workflow runs.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600">Set the daily schedule, publishing mode, LinkedIn destination, and safety rules for PostCraft’s recurring automation.</p></section>

    <section className="grid gap-8 border-b border-neutral-300/80 py-10 lg:grid-cols-[1fr_320px]">
      <div className="border border-neutral-300 bg-white/60 p-6 sm:p-8">
        <div className="flex items-center justify-between gap-4 border-b border-neutral-200 pb-5"><div><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Automation status</div><h2 className="mt-2 font-serif text-3xl">Daily publishing</h2></div><span className={`rounded-full px-3 py-1 text-[10px] font-medium ${enabled ? "bg-emerald-100 text-emerald-800" : "bg-neutral-200 text-neutral-600"}`}>{enabled ? "Active" : "Paused"}</span></div>
        {loading ? <p className="mt-7 text-sm text-neutral-500">Loading automation settings…</p> : <>
          <label className="mt-7 flex items-start justify-between gap-4"><span><span className="block text-sm font-medium">Enable daily auto-publishing</span><span className="mt-1 block text-xs leading-5 text-neutral-500">PostCraft will prepare one verified AI-related post each day. The saved time is your preferred run time.</span></span><button type="button" aria-label="Toggle daily auto-publishing" aria-pressed={enabled} onClick={() => { setEnabled(!enabled); setSaved(false); }} className={`relative h-6 w-11 shrink-0 rounded-full ${enabled ? "bg-neutral-900" : "bg-neutral-300"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white ${enabled ? "left-6" : "left-1"}`} /></button></label>
          <div className="my-7 border-t border-neutral-200" />
          <label className="block text-sm font-medium">Preferred run time<input type="time" step={900} value={time} onChange={(e) => { setTime(e.target.value); setSaved(false); }} className="mt-3 block w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm" /><span className="mt-2 block text-xs text-neutral-500">Asia/Kolkata (IST) · preferred time; daily scheduler timing may vary</span></label>
          <fieldset className="mt-7"><legend className="text-sm font-medium">Publishing mode</legend><div className="mt-4 space-y-4 text-sm">
            <label className="flex gap-3"><input type="radio" name="mode" checked={mode === "review"} onChange={() => { setMode("review"); setSaved(false); }} /><span><b>Review before publishing</b><span className="mt-1 block text-xs text-neutral-500">Prepare the daily draft and approve it yourself.</span></span></label>
            <label className="flex gap-3"><input type="radio" name="mode" checked={mode === "automatic"} onChange={() => { setMode("automatic"); setSaved(false); }} /><span><b>Automatic preparation</b><span className="mt-1 block text-xs text-neutral-500">Prepare the verified daily draft automatically. LinkedIn unattended publishing remains held until that integration is validated.</span></span></label>
          </div></fieldset>
          <div className="mt-7 border border-neutral-200 bg-white/70 p-4 text-xs leading-5 text-neutral-600"><b className="text-neutral-900">LinkedIn destination</b><br />Connection checks will run at publish time. LinkedIn unattended publishing is currently paused while the integration is being validated.</div>
          <button type="button" onClick={() => void saveSettings()} disabled={saving} className="mt-6 w-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving automation settings…" : "Save automation settings"}</button>
          {saved && <p className="mt-3 text-xs text-emerald-700" role="status">Settings saved to your account.</p>}
          {error && <p className="mt-3 text-xs text-red-700" role="alert">{error}</p>}
        </>}
      </div>

      <aside className="space-y-6"><div className="border border-neutral-300 bg-white/50 p-6"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Related workflow</div><h3 className="mt-3 font-serif text-2xl">Need to review a draft?</h3><p className="mt-3 text-sm leading-6 text-neutral-600">Auto-post is where you prepare, edit, and review the next recommended post.</p><Link href="/auto-post" className="mt-5 inline-block text-xs font-medium underline underline-offset-4">Open Auto-post →</Link></div><div className="border border-neutral-300 bg-white/50 p-6"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Safety rules</div><ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-600"><li>Source must be verified.</li><li>Previously used content is blocked.</li><li>LinkedIn authorization must be valid before publishing.</li><li>Only one daily draft is allowed per account.</li></ul></div></aside>
    </section>

    <section className="grid gap-6 py-10 sm:grid-cols-3"><div><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">01 · Schedule</div><p className="mt-3 text-sm leading-6 text-neutral-600">Choose your preferred daily run time in IST. The current Vercel scheduler runs once per day, so the actual invocation can vary.</p></div><div><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">02 · Review</div><p className="mt-3 text-sm leading-6 text-neutral-600">Decide whether the prepared draft should wait for your approval.</p></div><div><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">03 · Protect</div><p className="mt-3 text-sm leading-6 text-neutral-600">Verification, duplicate checks, and account access remain mandatory.</p></div></section>
  </div></main>;
}
