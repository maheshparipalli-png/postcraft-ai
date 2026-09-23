import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7"><Link href="/" className="font-serif text-[22px] font-semibold tracking-[-.03em]">POSTCRAFT</Link><Link href="/pricing" className="text-xs text-neutral-500 hover:text-neutral-900">Pricing</Link></header>
        <section className="py-16 sm:py-24"><div className="text-[11px] uppercase tracking-[.2em] text-neutral-500">Contact</div><h1 className="mt-5 font-serif text-6xl tracking-[-.05em] sm:text-8xl">We are here<br/>to help.</h1><p className="mt-7 max-w-2xl text-base leading-7 text-neutral-600">For account, billing, trial, payment or product questions, contact Ninety6 AI Solutions.</p>
          <div className="mt-12 grid gap-px border border-neutral-300 bg-neutral-300 sm:grid-cols-2">
            <div className="bg-[#f7f6f2] p-7"><div className="text-[11px] uppercase tracking-[.18em] text-neutral-500">Support email</div><a className="mt-4 block text-lg underline underline-offset-4" href="mailto:mpari@outlook.com">mpari@outlook.com</a></div>
            <div className="bg-[#f7f6f2] p-7"><div className="text-[11px] uppercase tracking-[.18em] text-neutral-500">Business</div><div className="mt-4 text-lg">Ninety6 AI Solutions</div></div>
            <div className="bg-[#f7f6f2] p-7 sm:col-span-2"><div className="text-[11px] uppercase tracking-[.18em] text-neutral-500">Business address</div><div className="mt-4 text-lg leading-7">615 Symphony Park Homes,<br/>Beeramguda, Hyderabad,<br/>Telangana, India.</div></div>
          </div>
        </section>
        <footer className="border-t border-neutral-300/80 py-8 text-xs text-neutral-500"><Link href="/">PostCraft AI</Link> · <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link> · <Link href="/refunds">Refunds</Link></footer>
      </div>
    </main>
  );
}
