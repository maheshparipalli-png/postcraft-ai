"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Subscription = {
  status: string;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  grace_ends_at: string | null;
};

type BillingResponse = {
  status: string;
  subscription: Subscription | null;
  error?: string;
};

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState("");

  async function loadBilling() {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" });
      const data = (await response.json()) as BillingResponse;
      setBilling(response.ok ? data : { status: "unauthenticated", subscription: null, error: data.error });
    } catch {
      setBilling({ status: "error", subscription: null, error: "Unable to load billing status" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBilling();
  }, []);

  useEffect(() => {
    const endsAt = billing?.subscription?.trial_ends_at;
    if (!endsAt || billing?.status !== "trialing") {
      setRemaining(null);
      return;
    }

    const updateRemaining = () => setRemaining(new Date(endsAt).getTime() - Date.now());
    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [billing]);

  async function startTrial() {
    setStarting(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/start-trial", { method: "POST" });
      const data = (await response.json()) as BillingResponse;
      if (!response.ok) {
        setMessage(data.error ?? "Unable to start the trial");
      } else {
        setMessage("Your 15-day free trial is now active.");
      }
      await loadBilling();
    } catch {
      setMessage("Unable to start the trial. Please try again.");
    } finally {
      setStarting(false);
    }
  }

  const status = billing?.status ?? "loading";
  const trialActive = status === "trialing" && remaining !== null && remaining > 0;

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7">
          <div>
            <Link href="/" className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCRAFT</Link>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">Billing & payment</div>
          </div>
          <nav className="flex flex-wrap items-center justify-end gap-4 text-xs" aria-label="Settings navigation">
            <Link href="/workspace" className="text-neutral-500 transition hover:text-neutral-900">Workspace</Link>
            <Link href="/auto-publish" className="text-neutral-500 transition hover:text-neutral-900">Auto-publish</Link>
          </nav>
        </header>

        <section className="border-b border-neutral-300/80 py-14 sm:py-20">
          <div className="max-w-3xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Account settings</div>
            <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.045em] sm:text-7xl">Payment,<br />kept simple.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">Try PostCraft Pro free for 15 days. No card is required to start. You will also have a 3-day grace period after the trial ends. Pricing will be announced before paid checkout is enabled.</p>
          </div>
        </section>

        <section className="grid gap-8 border-b border-neutral-300/80 py-10 lg:grid-cols-[1fr_1.2fr] lg:py-14">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Current plan</div>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em]">PostCraft Pro</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">Research, writing, LinkedIn publishing, and daily AI editorial automation.</p>
            <div className="mt-6 font-serif text-3xl">Paid plan — pricing coming soon</div>
            <div className="mt-7 border-t border-neutral-300 pt-5 text-sm text-neutral-600">
              Billing status: <span className="font-medium text-emerald-700">{loading ? "Loading…" : status === "not_started" ? "Trial available" : status === "trialing" ? "Free trial active" : status === "grace" ? "Grace period" : status === "expired" ? "Trial expired" : status === "unauthenticated" ? "Sign in required" : status}</span>
            </div>
          </div>

          <div className="border border-neutral-300 bg-white/50 p-6 sm:p-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Free trial</div>
            {loading ? (
              <p className="mt-5 text-sm text-neutral-600">Checking your trial status…</p>
            ) : status === "unauthenticated" ? (
              <p className="mt-5 text-sm leading-6 text-neutral-600">Please sign in before starting your free trial.</p>
            ) : trialActive ? (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="font-medium text-emerald-700">Your trial is active</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">You have access to Pro features for the remainder of your 24-hour trial.</p>
                </div>
                <div className="border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-800">Time remaining</div>
                  <div className="mt-2 font-mono text-2xl text-emerald-900">{formatRemaining(remaining)}</div>
                </div>
              </div>
            ) : status === "not_started" ? (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="font-medium">Start your 24-hour free trial</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">No payment details are required. Your trial can only be used once.</p>
                </div>
                <button type="button" onClick={startTrial} disabled={starting} className="border-b border-neutral-900 pb-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{starting ? "Starting…" : "Start free trial →"}</button>
              </div>
             ) : status === "grace" ? (\n              <div className="mt-5 space-y-4">\n                <div className="font-medium text-amber-800">Your trial has ended — grace period active</div>\n                <p className="text-sm leading-6 text-neutral-600">You still have temporary access while you decide whether to subscribe.</p>\n                <p className="text-sm text-neutral-500">Paid checkout will be enabled once pricing is finalized.</p>\n              </div>\n            ) : status === "expired" ? (
              <div className="mt-5 space-y-4">
                <div className="font-medium">Your free trial has ended</div>
                <p className="text-sm leading-6 text-neutral-600">Subscribe to PostCraft when paid checkout is enabled to continue using your workspace.</p>
                <button type="button" disabled className="border border-neutral-300 px-4 py-2 text-sm text-neutral-400">Subscribe with Razorpay — coming soon</button>
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-neutral-600">{billing?.error ?? "Billing information is unavailable."}</p>
            )}
            {message && <p className="mt-5 text-sm text-emerald-700" role="status">{message}</p>}
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400"><span>PostCraft AI</span><Link href="/auto-publish" className="hover:text-neutral-900">Configure daily publishing →</Link></footer>
      </div>
    </main>
  );
}
