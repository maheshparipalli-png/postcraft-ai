"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

const faqs = [
  {
    category: "Getting started",
    question: "How do I create my first LinkedIn post?",
    answer:
      "Choose a topic, discover an idea worth exploring, select an angle, and let PostCraft AI turn it into a LinkedIn-ready draft. You can then refine, copy, or save the result.",
  },
  {
    category: "Account and login",
    question: "How do I sign in?",
    answer:
      "Use the Google sign-in option on the login page. After authentication, you will be returned to your PostCraft workspace.",
  },
  {
    category: "LinkedIn",
    question: "How do I connect LinkedIn?",
    answer:
      "Open the LinkedIn connection area in your workspace and follow the authorization steps. LinkedIn access is used only for features that require your connection.",
  },
  {
    category: "LinkedIn",
    question: "Can I disconnect LinkedIn?",
    answer:
      "Yes. Open your account or LinkedIn connection settings and use the disconnect option. You can reconnect later when needed.",
  },
  {
    category: "Content creation",
    question: "Why can’t I generate a post?",
    answer:
      "Check that you have selected a story and an angle, and that the AI service is available. If the problem continues, contact support with the topic and the error message.",
  },
  {
    category: "Saved posts",
    question: "Where can I find my saved posts?",
    answer:
      "Open the Workspace area to view, search, filter, and manage your saved posts.",
  },
  {
    category: "Billing",
    question: "How does billing work?",
    answer:
      "Billing and subscription information is available from the Billing page. Payment processing is handled through the configured payment provider.",
  },
  {
    category: "Privacy and security",
    question: "Is my content secure?",
    answer:
      "Your account data is protected through authenticated access and database access policies. Never share passwords, access tokens, or payment details in a support request.",
  },
];

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const filteredFaqs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return faqs;
    return faqs.filter((faq) =>
      `${faq.category} ${faq.question} ${faq.answer}`
        .toLowerCase()
        .includes(normalized),
    );
  }, [query]);

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-[#171717]">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-12">
        <header className="flex items-center justify-between gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            PostCraft AI
          </Link>
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium transition hover:border-black/25"
          >
            Back to workspace
          </Link>
        </header>

        <section className="mx-auto max-w-3xl py-16 text-center sm:py-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#6b6b65]">
            Help &amp; Support
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">
            How can we help?
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-[#666660] sm:text-lg">
            Find answers about creating posts, connecting LinkedIn, managing your
            account, and using PostCraft AI.
          </p>

          <div className="relative mx-auto mt-9 max-w-2xl">
            <label htmlFor="help-search" className="sr-only">
              Search help articles
            </label>
            <input
              id="help-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for an answer..."
              className="w-full rounded-2xl border border-black/10 bg-white px-5 py-4 text-base outline-none transition placeholder:text-[#999990] focus:border-black/30 focus:ring-4 focus:ring-black/5"
            />
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  Frequently asked questions
                </h2>
                <p className="mt-2 text-sm text-[#6b6b65]">
                  Quick answers to common questions.
                </p>
              </div>
              <span className="text-sm text-[#77776f]">
                {filteredFaqs.length} {filteredFaqs.length === 1 ? "result" : "results"}
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
              {filteredFaqs.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-[#6b6b65]">
                  No matching answers found. Try a different search or contact support.
                </div>
              ) : (
                filteredFaqs.map((faq) => {
                  const isOpen = openQuestion === faq.question;
                  return (
                    <div key={faq.question} className="border-b border-black/10 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => setOpenQuestion(isOpen ? null : faq.question)}
                        className="flex w-full items-center justify-between gap-5 px-5 py-5 text-left transition hover:bg-[#fafaf8] sm:px-6"
                        aria-expanded={isOpen}
                      >
                        <span>
                          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-[#88887f]">
                            {faq.category}
                          </span>
                          <span className="font-medium">{faq.question}</span>
                        </span>
                        <span className="text-xl text-[#77776f]">{isOpen ? "−" : "+"}</span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5 text-sm leading-7 text-[#62625c] sm:px-6 sm:pb-6">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-black/10 bg-[#171717] p-6 text-white">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-white/55">
              Still need help?
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              We’re here to help.
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/65">
              Tell us what happened, include any relevant error message, and our team
              can help you troubleshoot the issue.
            </p>
            <Link
              href="/help/contact"
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-[#171717] transition hover:bg-white/85"
            >
              Contact support
            </Link>
            <p className="mt-4 text-xs leading-5 text-white/45">
              Please do not include passwords, access tokens, or payment card details.
            </p>
          </aside>
        </section>

        <footer className="mt-16 border-t border-black/10 pt-6 text-sm text-[#77776f]">
          <p>PostCraft AI Help Centre</p>
        </footer>
      </div>
    </main>
  );
}
