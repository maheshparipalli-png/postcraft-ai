"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Subscription = {
  status: string;
  trial_ends_at: string | null;
  trial_started_at: string | null;
  grace_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_cycle_end: boolean;
  cancellation_requested_at: string | null;
};

type BillingResponse = {
  status: string;
  subscription: Subscription | null;
  error?: string;
};



type RazorpayCheckout = {
  open: () => void;
};

type RazorpayOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  handler: (response: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayCheckout;
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function loadBilling() {
    try {
      const response = await fetch("/api/billing/status", { cache: "no-store" });
      const data = (await response.json()) as BillingResponse;
      if (response.ok) {
        setBilling(data);
      } else if (response.status === 401) {
        setBilling({ status: "unauthenticated", subscription: null, error: data.error });
      } else {
        setBilling({ status: "error", subscription: null, error: data.error ?? "Unable to load billing status" });
      }
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
    const timer = window.setInterval(updateRemaining, 60_000);
    return () => window.clearInterval(timer);
  }, [billing]);

  async function retryBilling() {
    setLoading(true);
    setMessage("");
    await loadBilling();
  }

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
  const cancellationPending =
    billing?.subscription?.cancel_at_cycle_end === true &&
    status === "active";

  async function cancelSubscription() {
    const confirmed = window.confirm(
      "Cancel auto-renewal at the end of your current billing period? You will keep paid access until then.",
    );
    if (!confirmed) return;

    setCancelling(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelAtCycleEnd: true }),
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Unable to cancel your subscription.");
        return;
      }

      setMessage(
        "Your subscription is scheduled to cancel at the end of the current billing period.",
      );
      await loadBilling();
    } catch {
      setMessage("Unable to cancel your subscription. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  async function subscribe() {
    setSubscribing(true);
    setMessage("");
    try {
      const response = await fetch("/api/billing/create-subscription", { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error ?? "Unable to start checkout.");
        return;
      }

      if (!data.subscriptionId || !data.keyId) {
        throw new Error("Razorpay did not return a valid subscription.");
      }

      // Razorpay can provide a hosted subscription URL. Use it as a reliable
      // fallback if the embedded Checkout.js modal cannot open in the browser.
      if (typeof data.shortUrl === "string" && data.shortUrl.startsWith("https://rzp.io/")) {
        window.location.assign(data.shortUrl);
        return;
      }

      if (!window.Razorpay) {
        await new Promise<void>((resolve, reject) => {
          const scriptSrc = "https://checkout.razorpay.com/v1/checkout.js";
          const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptSrc}"]`);

          if (existing) {
            if (window.Razorpay) {
              resolve();
              return;
            }

            const timeout = window.setTimeout(() => {
              if (window.Razorpay) {
                resolve();
              } else {
                reject(new Error("Razorpay Checkout failed to load"));
              }
            }, 10000);

            existing.addEventListener(
              "load",
              () => {
                window.clearTimeout(timeout);
                if (window.Razorpay) resolve();
                else reject(new Error("Razorpay Checkout loaded without initializing"));
              },
              { once: true },
            );
            existing.addEventListener(
              "error",
              () => {
                window.clearTimeout(timeout);
                reject(new Error("Razorpay Checkout failed to load"));
              },
              { once: true },
            );
            return;
          }

          const script = document.createElement("script");
          script.src = scriptSrc;
          script.async = true;
          script.onload = () => {
            if (window.Razorpay) resolve();
            else reject(new Error("Razorpay Checkout loaded without initializing"));
          };
          script.onerror = () => reject(new Error("Razorpay Checkout failed to load"));
          document.body.appendChild(script);
        });
      }

      if (!window.Razorpay) throw new Error("Razorpay Checkout is unavailable.");

      const checkout = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: "PostCraft AI",
        description: "PostCraft Pro subscription",
        handler: async (payment) => {
          const verifyResponse = await fetch("/api/billing/verify-subscription", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payment),
          });
          const verifyData = await verifyResponse.json();
          if (!verifyResponse.ok) {
            setMessage(verifyData.error ?? "Payment verification failed. Please contact support.");
            return;
          }
          setMessage(
            verifyResponse.status === 202
              ? "Payment verified. Waiting for Razorpay to activate your subscription…"
              : "Payment verified. Your PostCraft Pro subscription is being activated.",
          );
          await loadBilling();

          // Webhook delivery is authoritative, so briefly refresh while activation propagates.
          for (let attempt = 0; attempt < 6; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 2000));
            await loadBilling();
          }
        },
        modal: { ondismiss: () => setMessage("Checkout was closed. No payment was made.") },
      });
      checkout.open();
    } catch (error) {
      console.error("Razorpay checkout error:", error);
      const detail = error instanceof Error ? error.message : "Unknown checkout error";
      setMessage(`Unable to open secure checkout: ${detail}`);
    } finally {
      setSubscribing(false);
    }
  }

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
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">Try PostCraft Pro free for 15 days. No card is required to start. When your trial or grace period ends, you can continue with secure Razorpay checkout.</p>
          </div>
        </section>

        <section className="grid gap-8 border-b border-neutral-300/80 py-10 lg:grid-cols-[1fr_1.2fr] lg:py-14">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Current plan</div>
            <h2 className="mt-3 font-serif text-3xl tracking-[-0.025em]">PostCraft Pro</h2>
            <p className="mt-3 text-sm leading-6 text-neutral-600">Research, writing, LinkedIn publishing, and daily AI editorial automation.</p>
            <div className="mt-6 font-serif text-3xl">PostCraft Pro — ₹499/month</div>
            <p className="mt-2 text-sm leading-6 text-neutral-600">Billed monthly through Razorpay when you subscribe. Review the amount and billing start date in checkout before confirming.</p>
            <div className="mt-7 border-t border-neutral-300 pt-5 text-sm text-neutral-600">
              Billing status: <span className={status === "active" || status === "trialing" ? "font-medium text-emerald-700" : status === "grace" || status === "past_due" ? "font-medium text-amber-800" : "font-medium text-neutral-700"}>{loading ? "Loading…" : status === "not_started" ? "Trial available" : status === "trialing" ? "Free trial active" : status === "grace" ? "Grace period" : status === "expired" ? "Trial expired" : status === "unauthenticated" ? "Sign in required" : status === "past_due" ? "Payment needs attention" : status === "cancelled" ? "Subscription cancelled" : status === "suspended" ? "Account suspended" : status === "error" ? "Status unavailable" : status}</span>
            </div>
            {billing?.subscription?.current_period_start && billing?.subscription?.current_period_end && (
              <div className="mt-4 text-sm text-neutral-600">
                <div>Current billing period</div>
                <div className="mt-1 font-medium text-neutral-900">
                  {new Date(billing.subscription.current_period_start).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  {" – "}
                  {new Date(billing.subscription.current_period_end).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            )}
          </div>

          <div className="border border-neutral-300 bg-white/50 p-6 sm:p-8">
            <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
              {status === "active" ? "Subscription" : "Free trial"}
            </div>
            {loading ? (
              <p className="mt-5 text-sm text-neutral-600">Checking your trial status…</p>
            ) : status === "unauthenticated" ? (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-neutral-600">Sign in to view your plan or start a free trial.</p>
                <Link href="/login?mode=signin&next=%2Fbilling" className="inline-block border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white">Sign in to continue →</Link>
              </div>
            ) : trialActive ? (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="font-medium text-emerald-700">Your trial is active</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">You have full access during your 15-day trial. You can subscribe now if you want to continue as a paid customer without waiting for the trial to end.</p>
                </div>
                <button type="button" onClick={subscribe} disabled={subscribing} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{subscribing ? "Opening secure checkout…" : "Subscribe now →"}</button>
                <div className="border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-emerald-800">Trial period</div>
                  <div className="mt-2 text-lg font-medium text-emerald-900">Ends {formatDate(billing!.subscription!.trial_ends_at!)}</div>
                  <div className="mt-1 text-sm text-emerald-800">{Math.max(0, Math.ceil((remaining ?? 0) / 86400000))} days remaining</div>
                </div>
              </div>
            ) : status === "not_started" ? (
              <div className="mt-5 space-y-5">
                <div>
                  <div className="font-medium">Start your 15-day free trial</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">No payment details are required. Your trial can only be used once.</p>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <button type="button" onClick={startTrial} disabled={starting || subscribing} className="border-b border-neutral-900 pb-1 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50">{starting ? "Starting…" : "Start free trial →"}</button>
                  <button type="button" onClick={subscribe} disabled={subscribing || starting} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{subscribing ? "Opening secure checkout…" : "Subscribe now →"}</button>
                </div>
              </div>
             ) : status === "grace" ? (
              <div className="mt-5 space-y-4">
                <div className="font-medium text-amber-800">Your trial has ended — grace period active</div>
                <p className="text-sm leading-6 text-neutral-600">You still have temporary access while you decide whether to subscribe.</p>
                <button type="button" onClick={subscribe} disabled={subscribing} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{subscribing ? "Opening secure checkout…" : "Subscribe with Razorpay →"}</button>
              </div>
            ) : status === "expired" ? (
              <div className="mt-5 space-y-4">
                <div className="font-medium">Your free trial has ended</div>
                <p className="text-sm leading-6 text-neutral-600">Subscribe to PostCraft Pro to restore access to your workspace.</p>
                <button type="button" onClick={subscribe} disabled={subscribing} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{subscribing ? "Opening secure checkout…" : "Subscribe with Razorpay →"}</button>
              </div>
            ) : status === "past_due" ? (
              <div className="mt-5 space-y-4">
                <div className="font-medium text-amber-800">Payment needs attention</div>
                <p className="text-sm leading-6 text-neutral-600">Your last payment did not complete. Resume secure checkout to restore your Pro access.</p>
                <button type="button" onClick={subscribe} disabled={subscribing} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{subscribing ? "Opening secure checkout…" : "Resume checkout →"}</button>
              </div>
            ) : status === "cancelled" ? (
              <div className="mt-5 space-y-4">
                <div className="font-medium">Your subscription has ended</div>
                <p className="text-sm leading-6 text-neutral-600">Subscribe again to restore access to your workspace.</p>
                <button type="button" onClick={subscribe} disabled={subscribing} className="border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50">{subscribing ? "Opening secure checkout…" : "Subscribe again →"}</button>
              </div>
            ) : status === "suspended" ? (
              <div className="mt-5 space-y-4">
                <div className="font-medium text-amber-800">Account access is suspended</div>
                <p className="text-sm leading-6 text-neutral-600">Contact support for help restoring your account.</p>
                <Link href="/help/contact" className="inline-block border border-neutral-900 px-4 py-2 text-sm">Contact support →</Link>
              </div>
            ) : status === "active" ? (
              <div className="mt-5 space-y-5">
                {cancellationPending ? (
                  <div className="border border-amber-200 bg-amber-50 p-5">
                    <div className="font-medium text-amber-900">Cancellation scheduled</div>
                    <p className="mt-2 text-sm leading-6 text-amber-900/80">
                      Auto-renewal is off. Your paid access remains available until the end of the current billing period.
                    </p>
                  </div>
                ) : (
                  <>
                    <div>
                      <div className="font-medium text-emerald-700">PostCraft Pro is active</div>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">Your subscription is active and your workspace has full Pro access.</p>
                    </div>
                    <button type="button" onClick={cancelSubscription} disabled={cancelling} className="border border-red-300 px-4 py-2 text-sm text-red-700 disabled:cursor-not-allowed disabled:opacity-50">
                      {cancelling ? "Cancelling…" : "Cancel at period end"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <p className="text-sm leading-6 text-neutral-600">{billing?.error ?? "We couldn't load your billing information."}</p>
                <button type="button" onClick={retryBilling} disabled={loading} className="border border-neutral-900 px-4 py-2 text-sm disabled:opacity-50">{loading ? "Checking…" : "Try again"}</button>
                <Link href="/help/contact" className="ml-3 text-sm underline underline-offset-4">Contact support</Link>
              </div>
            )}
            {message && <p className="mt-5 text-sm text-neutral-700" role="status">{message}</p>}
          </div>
        </section>

        <footer className="flex items-center justify-between border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400"><span>PostCraft AI</span><Link href="/auto-publish" className="hover:text-neutral-900">Configure daily publishing →</Link></footer>
      </div>
    </main>
  );
}
