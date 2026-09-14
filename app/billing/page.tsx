"use client";

import Link from "next/link";
import { useState } from "react";

export default function BillingPage() {
  const [showCheckout, setShowCheckout] = useState(false);
  const [saved, setSaved] = useState(false);

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
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">Manage your PostCraft plan and payment method. Card details should be collected by a secure payment provider, never stored directly by PostCraft.</p>
          </div>
        </section>

        <section className="grid gap-8 border-b border-neutral-300/80 py-10 lg:grid-cols-[1fr_1.2fr] lg:py-14">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Current plan</div>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em]">PostCraft Pro</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">For creators who want research, writing, LinkedIn publishing, and daily AI editorial automation.</p>
            <div className="mt-6 flex items-baseline gap-2"><span className="font-serif text-4xl">₹999</span><span className="text-sm text-neutral-500">/ month</span></div>
            <div className="mt-7 border-t border-neutral-300 pt-5 text-sm text-neutral-600">Billing status: <span className="font-medium text-emerald-700">Ready for setup</span></div>
          </div>

          <div className="border border-neutral-300 bg-white/50 p-6 sm:p-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Payment method</div>
            <div className="mt-5 flex items-start justify-between gap-5 border-b border-neutral-200 pb-6">
              <div>
                <div className="font-medium">No payment method added</div>
                <p className="mt-2 text-sm leading-6 text-neutral-500">Add a card through secure checkout to activate paid features.</p>
              </div>
              <span className="border border-neutral-300 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-neutral-500">Secure</span>
            </div>

            {!showCheckout ? (
              <button type="button" onClick={() => setShowCheckout(true)} className="mt-6 border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2">Add payment method →</button>
            ) : (
              <div className="mt-6 space-y-5">
                <div className="border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">This is the payment setup screen. The production version should open Stripe Checkout or Stripe Elements here so PostCraft never handles raw card numbers.</div>
                <label className="block"><span className="text-xs font-medium">Billing email</span><input type="email" placeholder="you@example.com" className="mt-2 w-full border-b border-neutral-400 bg-transparent px-0 py-3 text-sm outline-none focus:border-neutral-900" /></label>
                <div className="grid gap-3 sm:grid-cols-2"><div className="border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">Card details handled by payment provider</div><div className="border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">No card data stored here</div></div>
                <div className="flex flex-wrap gap-5 text-sm"><button type="button" onClick={() => { setSaved(true); setShowCheckout(false); }} className="border-b border-neutral-900 pb-1 font-medium">Continue securely →</button><button type="button" onClick={() => setShowCheckout(false)} className="text-neutral-500 hover:text-neutral-900">Cancel</button></div>
                {saved && <p className="text-sm text-emerald-700">Payment setup placeholder saved. Connect Stripe to activate real billing.</p>}
              </div>
            )}
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400"><span>PostCraft AI</span><Link href="/auto-publish" className="hover:text-neutral-900">Configure daily publishing →</Link></footer>
      </div>
    </main>
  );
}
