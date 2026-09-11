"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreatePostPage() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Thoughtful");
  const [audience, setAudience] = useState("");
  const [length, setLength] = useState("Medium");
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);

  function handleSaveDraft() {
    setSaved(true);
  }

  function handleClear() {
    setTopic("");
    setAudience("");
    setDraft("");
    setSaved(false);
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8 dark:bg-black">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-black/10 pb-6 dark:border-white/10">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="text-sm text-neutral-500 hover:text-black dark:hover:text-white"
          >
            ← Back to workspace
          </button>

          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Create a post
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Turn an idea into a clear, thoughtful LinkedIn-ready draft.
          </p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-950">
            <h2 className="text-lg font-semibold">Post settings</h2>

            <div className="mt-6 space-y-5">
              <label className="block text-sm font-medium">
                Topic or idea
                <textarea
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="What do you want to say?"
                  rows={5}
                  className="mt-2 w-full resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15"
                />
              </label>

              <label className="block text-sm font-medium">
                Writing style
                <select
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm dark:border-white/15"
                >
                  <option>Thoughtful</option>
                  <option>Professional</option>
                  <option>Conversational</option>
                  <option>Bold</option>
                  <option>Storytelling</option>
                  <option>Analytical</option>
                </select>
              </label>

              <label className="block text-sm font-medium">
                Target audience
                <input
                  value={audience}
                  onChange={(event) => setAudience(event.target.value)}
                  placeholder="For example: founders, HR leaders"
                  className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15"
                />
              </label>

              <label className="block text-sm font-medium">
                Desired length
                <select
                  value={length}
                  onChange={(event) => setLength(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm dark:border-white/15"
                >
                  <option>Short</option>
                  <option>Medium</option>
                  <option>Long</option>
                </select>
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Draft editor</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Write or generate your post here.
                </p>
              </div>

              <span className="rounded-full bg-black/5 px-3 py-1 text-xs text-neutral-500 dark:bg-white/10">
                {length} · {style}
              </span>
            </div>

            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Start writing your post here..."
              rows={18}
              className="mt-6 w-full resize-y rounded-xl border border-black/15 bg-transparent px-4 py-4 text-base leading-7 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15"
            />

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                {draft.length} characters
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleClear}
                  className="rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 dark:bg-white dark:text-black"
                >
                  Save draft
                </button>
              </div>
            </div>

            {saved && (
              <p className="mt-4 text-sm text-green-600">
                Draft saved locally for now.
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
