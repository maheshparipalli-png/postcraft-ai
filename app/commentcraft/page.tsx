"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CommentCraftDashboard() {
  const router = useRouter();
  const [profileUrl, setProfileUrl] = useState("");
  const [postUrl, setPostUrl] = useState("");
  const [postText, setPostText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");

  function openLinkedIn() {
    const value = profileUrl.trim();
    if (!value) {
      setMessage("Enter a LinkedIn profile URL first.");
      return;
    }

    try {
      const parsed = new URL(value);
      if (parsed.hostname !== "www.linkedin.com" && parsed.hostname !== "linkedin.com") {
        throw new Error();
      }
      if (!/^\/in\/[^/]+\/?$/i.test(parsed.pathname)) throw new Error();
      window.open(parsed.toString(), "_blank", "noopener,noreferrer");
      setMessage("LinkedIn is open. Go to Posts, open the latest post, and copy its text and URL here.");
    } catch {
      setMessage("Enter a LinkedIn profile URL such as https://www.linkedin.com/in/warikoo/.");
    }
  }

  async function generate() {
    if (!postText.trim()) return;
    setGenerating(true);
    setMessage("");

    try {
      const response = await fetch("/api/commentcraft/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: postUrl.trim() || profileUrl.trim() || null,
          postText: postText.trim(),
          summary: "",
          preset: "thoughtful",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate comments.");
      router.push("/commentcraft/queue/" + data.post.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate comments.");
    } finally {
      setGenerating(false);
    }
  }

  const wordCount = postText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6">
          <div>
            <Link href="/" className="font-serif text-[22px] font-semibold">POSTCRAFT</Link>
            <div className="text-[11px] uppercase tracking-[.2em] text-neutral-500">CommentCraft</div>
          </div>
          <nav className="flex gap-4 text-xs">
            <Link href="/create" className="text-neutral-600 hover:text-black">Write</Link>
            <Link href="/auto-post" className="text-neutral-600 hover:text-black">Auto-post</Link>
            <Link href="/commentcraft/import" className="text-neutral-600 hover:text-black">Manual import</Link>
            <Link href="/commentcraft/queue" className="text-neutral-600 hover:text-black">Review queue</Link>
          </nav>
        </header>

        <section className="py-14">
          <div className="max-w-3xl">
            <div className="text-[10px] font-semibold uppercase tracking-[.18em] text-neutral-400">Engage thoughtfully</div>
            <h1 className="mt-3 font-serif text-5xl tracking-[-.045em]">Find the latest post worth responding to.</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-600">
              Open the person's LinkedIn activity, choose the latest post, paste the post here, and let PostCraft write four thoughtful comments.
            </p>
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <aside className="border border-neutral-200 bg-white p-7">
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">1 / Find a person</div>
            <label className="mt-5 block text-xs font-medium uppercase tracking-[.14em] text-neutral-500">LinkedIn profile URL</label>
            <input
              value={profileUrl}
              onChange={(e) => setProfileUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") openLinkedIn(); }}
              placeholder="https://www.linkedin.com/in/warikoo/"
              className="mt-3 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-black"
            />
            <button
              onClick={openLinkedIn}
              disabled={!profileUrl.trim()}
              className="mt-7 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
            >
              Open LinkedIn posts →
            </button>
            <p className="mt-5 text-xs leading-5 text-neutral-500">
              PostCraft does not scrape LinkedIn or pretend a web-search result is the latest post. You choose the actual post from LinkedIn.
            </p>
          </aside>

          <section className="border border-neutral-200 bg-white p-7">
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">2 / Confirm the post</div>
            <h2 className="mt-2 font-serif text-3xl">Paste the latest LinkedIn post</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">
              In LinkedIn, open the person's latest post, copy the full text, and paste it below. Adding the post URL is optional but helps keep the source attached to the comment review.
            </p>

            <label className="mt-6 block text-xs font-medium uppercase tracking-[.14em] text-neutral-500">LinkedIn post URL <span className="font-normal normal-case tracking-normal text-neutral-400">(optional)</span></label>
            <input
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://www.linkedin.com/posts/..."
              className="mt-3 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-black"
            />

            <label className="mt-6 block text-xs font-medium uppercase tracking-[.14em] text-neutral-500">Post text</label>
            <textarea
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              rows={10}
              className="mt-3 w-full border border-neutral-200 bg-[#f7f6f2] p-4 text-sm leading-6 outline-none focus:border-neutral-900"
              placeholder="Paste the full LinkedIn post text here..."
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-neutral-500">{wordCount} words available to PostCraft</span>
              <button
                onClick={generate}
                disabled={generating || !postText.trim()}
                className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
              >
                {generating ? "Generating…" : "Generate comments →"}
              </button>
            </div>
          </section>
        </section>

        {message && (
          <div className="my-8 border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600">
            {message}
          </div>
        )}

        <div className="mb-12 mt-8 text-xs text-neutral-500">
          Prefer to work from content you already have? <Link href="/commentcraft/import" className="underline underline-offset-4">Use Manual import</Link>.
        </div>
      </div>
    </main>
  );
}
