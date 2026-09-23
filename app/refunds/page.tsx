import Link from "next/link";

export default function RefundsPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]"><div className="mx-auto max-w-4xl px-5 sm:px-8">
      <header className="flex items-center justify-between border-b border-neutral-300/80 py-6"><Link href="/" className="font-serif text-[22px] font-semibold">POSTCRAFT</Link><Link href="/contact" className="text-xs text-neutral-500">Contact</Link></header>
      <article className="py-14 sm:py-20"><div className="text-[11px] uppercase tracking-[.2em] text-neutral-500">Billing</div><h1 className="mt-4 font-serif text-5xl tracking-[-.04em] sm:text-6xl">Refund & Cancellation Policy</h1><p className="mt-4 text-sm text-neutral-500">Last updated: September 23, 2026</p>
        <div className="prose prose-neutral mt-10 max-w-none text-sm leading-7"><h2>1. Free trial</h2><p>The PostCraft Pro trial is available for 15 days to eligible new users. No payment details are required to start the trial.</p><h2>2. Subscription</h2><p>PostCraft Pro is ₹499 per month. Paid subscriptions are processed through Razorpay. You may cancel your subscription through the available account or billing controls, or contact support for assistance.</p><h2>3. Cancellation</h2><p>Cancellation stops future subscription renewals. Access to paid features may continue through the period already paid for, subject to the subscription status returned by the payment provider.</p><h2>4. Refunds</h2><p>Because digital access is delivered immediately, refunds are considered based on the circumstances of the request and applicable law. If you believe you were charged incorrectly or have a payment issue, contact us promptly with your account and transaction details.</p><h2>5. Payment disputes</h2><p>For a payment issue, please contact Ninety6 AI Solutions first so we can investigate the transaction and assist with resolution.</p><h2>6. Contact</h2><p>Email: <a href="mailto:mpari@outlook.com">mpari@outlook.com</a><br/>Ninety6 AI Solutions<br/>615 Symphony Park Homes, Beeramguda, Hyderabad, Telangana, India.</p></div>
      </article>
      <footer className="border-t border-neutral-300/80 py-8 text-xs text-neutral-500"><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/contact">Contact</Link></footer>
    </div></main>
  );
}
