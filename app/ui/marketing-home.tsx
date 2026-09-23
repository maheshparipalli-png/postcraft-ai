"use client";

import Link from "next/link";

type Props = {
  authenticated?: boolean;
  notice?: string;
};

const features = [
  ["01", "Discover", "Find relevant stories and ideas worth turning into a LinkedIn point of view."],
  ["02", "Write", "Turn one idea into a clear, thoughtful LinkedIn post without starting from a blank page."],
  ["03", "PostCard", "Create a polished visual companion for your strongest ideas."],
  ["04", "CommentCraft", "Write useful, human-sounding comments that add something to the conversation."],
  ["05", "Workspace", "Keep drafts, finished posts, and ideas together so good work does not disappear."],
  ["06", "Publish", "Connect LinkedIn when you are ready and move from draft to published post."],
];

export default function MarketingHome({ authenticated = false, notice = "" }: Props) {
  const primaryHref = authenticated ? "/billing" : "/login";
  const primaryLabel = authenticated ? "Start your free trial →" : "Start 15-day free trial →";

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      {notice && (
        <div className="border-b border-amber-300 bg-amber-50 px-5 py-3 text-center text-sm text-amber-900">
          {notice}
        </div>
      )}

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <section className="border-b border-neutral-300/80 pb-16 pt-20 sm:pb-24 sm:pt-28">
          <div className="max-w-5xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">AI-powered LinkedIn content</div>
            <h1 className="mt-6 max-w-5xl font-serif text-6xl leading-[0.9] tracking-[-0.055em] sm:text-8xl">
              Write something<br className="hidden sm:block" /> worth saying.
            </h1>
            <p className="mt-8 max-w-2xl text-lg leading-8 text-neutral-600">
              PostCraft helps you discover ideas, shape a point of view, write better LinkedIn posts, create branded visuals, and keep your content organized.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-5">
              <Link href={primaryHref} className="rounded-full bg-neutral-900 px-6 py-3.5 text-sm font-medium text-white transition hover:bg-neutral-700">
                {primaryLabel}
              </Link>
              {!authenticated && (
                <Link href="/login" className="text-sm font-medium underline underline-offset-4">
                  Sign in
                </Link>
              )}
            </div>
            <div className="mt-5 text-xs text-neutral-500">15 days free · 3-day grace period · ₹499/month after trial</div>
          </div>
        </section>

        <section className="border-b border-neutral-300/80 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">The workflow</div>
              <h2 className="mt-3 font-serif text-3xl tracking-[-0.03em]">From idea to post.</h2>
            </div>
            <div className="grid gap-px border border-neutral-300 bg-neutral-300 sm:grid-cols-2">
              {features.map(([number, title, description]) => (
                <div key={title} className="bg-[#f7f6f2] p-7 sm:p-8">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">{number}</div>
                  <h3 className="mt-7 font-serif text-2xl">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-neutral-300/80 py-16 sm:py-24">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr] lg:items-end">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">PostCraft Pro</div>
              <h2 className="mt-4 font-serif text-4xl tracking-[-0.035em] sm:text-5xl">One workspace for your LinkedIn workflow.</h2>
            </div>
            <div className="border border-neutral-300 bg-white/50 p-7">
              <div className="font-serif text-4xl">₹499 <span className="font-sans text-base text-neutral-500">/ month</span></div>
              <p className="mt-3 text-sm leading-6 text-neutral-600">Start with a 15-day free trial. No payment details are required to begin.</p>
              <Link href="/pricing" className="mt-5 inline-block text-sm font-medium underline underline-offset-4">View pricing →</Link>
            </div>
          </div>
        </section>

        <section className="border-b border-neutral-300/80 py-16 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-end">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Built for LinkedIn today</div>
              <h2 className="mt-5 max-w-xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] sm:text-6xl">
                One idea.<br />A better way to say it.
              </h2>
            </div>
            <div className="max-w-xl text-sm leading-7 text-neutral-600">
              PostCraft is focused on LinkedIn first. The underlying content and account architecture is designed so additional social channels can be added later without rebuilding your workspace.
            </div>
          </div>
        </section>

        <section className="py-16 sm:py-24">
          <div className="border border-neutral-300 bg-white/50 p-8 sm:p-12">
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Try PostCraft</div>
            <div className="mt-5 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="font-serif text-4xl tracking-[-0.035em] sm:text-5xl">15 days to find your workflow.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">Your trial includes the current PostCraft content workflow. If you need more time, support can extend the trial from the admin console.</p>
              </div>
              <Link href={primaryHref} className="shrink-0 border-b border-neutral-900 pb-1 text-sm font-medium">{primaryLabel}</Link>
            </div>
          </div>
        </section>

        <footer className="flex flex-col gap-3 border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <span>PostCraft AI · Ninety6 AI Solutions</span>
            <span>615 Symphony Park Homes, Beeramguda, Hyderabad, Telangana, India · mpari@outlook.com</span>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/pricing" className="hover:text-neutral-900">Pricing</Link>
            <Link href="/contact" className="hover:text-neutral-900">Contact</Link>
            <Link href="/privacy" className="hover:text-neutral-900">Privacy</Link>
            <Link href="/terms" className="hover:text-neutral-900">Terms</Link>
            <Link href="/refunds" className="hover:text-neutral-900">Refunds</Link>
          </div>
        </footer>
      </div>
    </main>
  );
}
