"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ContactSupportPage() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] px-5 py-8 text-[#171717] sm:px-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <Link href="/help" className="text-sm font-medium text-[#666660] hover:text-[#171717]">
          ← Back to Help Centre
        </Link>

        <div className="mt-12 rounded-2xl border border-black/10 bg-white p-6 sm:p-10">
          {submitted ? (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e9f5e9] text-xl">
                ✓
              </div>
              <h1 className="mt-5 text-2xl font-semibold tracking-tight">Request received</h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#666660]">
                Thank you for contacting us. Your request has been captured. We’ll add email
                delivery and request tracking as the support system is connected.
              </p>
              <Link
                href="/help"
                className="mt-7 inline-flex rounded-full bg-[#171717] px-5 py-3 text-sm font-semibold text-white"
              >
                Return to Help Centre
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#88887f]">
                Help &amp; Support
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight">Contact support</h1>
              <p className="mt-3 text-sm leading-6 text-[#666660]">
                Describe the issue clearly and include any relevant error message. Please do not
                include passwords, access tokens, or payment card details.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <div>
                  <label htmlFor="category" className="mb-2 block text-sm font-medium">
                    Category
                  </label>
                  <select
                    id="category"
                    required
                    className="w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-black/30"
                  >
                    <option value="">Select a category</option>
                    <option>Account and login</option>
                    <option>LinkedIn connection</option>
                    <option>Content generation</option>
                    <option>Saved posts</option>
                    <option>Billing</option>
                    <option>Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="mb-2 block text-sm font-medium">
                    Subject
                  </label>
                  <input
                    id="subject"
                    required
                    placeholder="What do you need help with?"
                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-[#999990] focus:border-black/30"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-medium">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-[#999990] focus:border-black/30"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="mb-2 block text-sm font-medium">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={6}
                    placeholder="Tell us what happened..."
                    className="w-full resize-y rounded-xl border border-black/10 px-4 py-3 text-sm outline-none placeholder:text-[#999990] focus:border-black/30"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-full bg-[#171717] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#333333]"
                >
                  Submit support request
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
