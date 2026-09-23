import Link from "next/link";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7">
          <div><Link href="/" className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCRAFT</Link><div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">Pricing</div></div>
          <nav className="flex gap-4 text-xs"><Link href="/contact" className="text-neutral-500 hover:text-neutral-900">Contact</Link><Link href="/login" className="text-neutral-500 hover:text-neutral-900">Sign in</Link></nav>
        </header>
        <section className="py-16 sm:py-24">
          <div className="max-w-3xl"><div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Simple pricing</div><h1 className="mt-5 font-serif text-6xl leading-[.92] tracking-[-.05em] sm:text-8xl">Create better<br/>LinkedIn content.</h1><p className="mt-7 max-w-2xl text-base leading-7 text-neutral-600">PostCraft Pro brings research, editorial writing, visuals, comments, workspace tools and LinkedIn publishing into one workflow.</p></div>
          <div className="mt-12 max-w-xl border border-neutral-300 bg-white/60 p-7 sm:p-10">
            <div className="text-[11px] uppercase tracking-[.18em] text-neutral-500">PostCraft Pro</div>
            <div className="mt-4 font-serif text-5xl">₹499 <span className="font-sans text-base text-neutral-500">/ month</span></div>
            <ul className="mt-7 space-y-3 text-sm leading-6 text-neutral-700">
              <li>• AI-assisted story discovery and editorial writing</li><li>• PostCard visual creation</li><li>• CommentCraft</li><li>• Workspace for drafts and published work</li><li>• LinkedIn connection and publishing</li>
            </ul>
            <div className="mt-8 border-t border-neutral-200 pt-6 text-sm text-neutral-600"><strong>15-day free trial</strong> · no payment details required to start · 3-day grace period after trial</div>
            <Link href="/login" className="mt-8 inline-block rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white hover:bg-neutral-700">Start your free trial →</Link>
          </div>
        </section>
        <footer className="border-t border-neutral-300/80 py-8 text-xs text-neutral-500"><div className="flex flex-wrap gap-5"><Link href="/contact">Contact</Link><Link href="/privacy">Privacy Policy</Link><Link href="/terms">Terms of Service</Link><Link href="/refunds">Refund & Cancellation</Link></div></footer>
      </div>
    </main>
  );
}
