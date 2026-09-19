"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Source = {
  id: string;
  url: string;
  label: string;
  active: boolean;
  last_checked_at?: string | null;
  last_error?: string | null;
};

type Draft = {
  id: string;
  source_id?: string | null;
  post_url: string;
  author: string;
  post_text: string;
  comment_text: string;
  status: string;
  created_at: string;
};

export default function CommentCraftPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [sourceResponse, draftResponse] = await Promise.all([
        fetch("/api/commentcraft/sources", { cache: "no-store" }),
        fetch("/api/commentcraft/drafts", { cache: "no-store" }),
      ]);
      const sourceData = await sourceResponse.json();
      const draftData = await draftResponse.json();
      if (!sourceResponse.ok) throw new Error(sourceData?.error || "Could not load sources.");
      if (!draftResponse.ok) throw new Error(draftData?.error || "Could not load drafts.");
      setSources(sourceData.sources || []);
      setDrafts(draftData.drafts || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load CommentCraft.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function addSource(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    setAdding(true);
    setMessage("");
    try {
      const response = await fetch("/api/commentcraft/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, label }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not add source.");
      setUrl("");
      setLabel("");
      setMessage("Source added.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not add source.");
    } finally {
      setAdding(false);
    }
  }

  async function checkSources() {
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/commentcraft/check", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not check sources.");
      const newPosts = (data.results || []).filter((item: { status: string }) => item.status === "new_post").length;
      setMessage(newPosts ? newPosts + " new post(s) found and added to review." : "No new posts found.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not check sources.");
    } finally {
      setChecking(false);
    }
  }

  async function removeSource(id: string) {
    await fetch("/api/commentcraft/sources?id=" + encodeURIComponent(id), { method: "DELETE" });
    await load();
  }

  async function generateComment(id: string) {
    setGenerating(id);
    setMessage("");
    try {
      const response = await fetch("/api/commentcraft/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not generate comment.");
      setDrafts((current) => current.map((draft) => draft.id === id ? data.draft : draft));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate comment.");
    } finally {
      setGenerating(null);
    }
  }

  async function saveDraft(id: string, commentText: string) {
    const response = await fetch("/api/commentcraft/drafts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, commentText, status: "needs_review" }),
    });
    const data = await response.json();
    if (response.ok) setDrafts((current) => current.map((draft) => draft.id === id ? data.draft : draft));
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300 pb-6">
          <div>
            <Link href="/" className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCRAFT</Link>
            <div className="mt-1 text-[11px] uppercase tracking-[0.2em] text-neutral-500">CommentCraft</div>
          </div>
          <Link href="/" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">Back to PostCraft</Link>
        </header>

        <section className="py-10">
          <div className="max-w-3xl">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Engage thoughtfully</div>
            <h1 className="mt-3 font-serif text-4xl tracking-[-0.04em] sm:text-5xl">Turn useful posts into useful conversations.</h1>
            <p className="mt-4 text-base leading-7 text-neutral-600">
              Add posts you want to follow. CommentCraft checks them, brings new posts into your review queue, and writes a specific comment rather than a generic compliment.
            </p>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-6">
              <form onSubmit={addSource} className="border border-neutral-200 bg-white p-6">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">1 / Add a source</div>
                <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.linkedin.com/posts/..." className="mt-5 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-neutral-900" />
                <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Optional label" className="mt-4 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-neutral-900" />
                <button disabled={adding} className="mt-6 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{adding ? "Adding..." : "Add source →"}</button>
                <p className="mt-4 text-xs leading-5 text-neutral-500">For this first version, use a direct LinkedIn post URL. Profile-level automatic discovery requires LinkedIn read access that is restricted to approved developers. citeturn0search1turn0search3</p>
              </form>

              <div className="border border-neutral-200 bg-white p-6">
                <div className="flex items-center justify-between">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">2 / Watchlist</div>
                  <button onClick={checkSources} disabled={checking || !sources.length} className="text-xs font-semibold underline underline-offset-4 disabled:opacity-40">{checking ? "Checking..." : "Check now"}</button>
                </div>
                <div className="mt-5 space-y-4">
                  {loading ? <p className="text-sm text-neutral-500">Loading...</p> : sources.length === 0 ? <p className="text-sm leading-6 text-neutral-500">No sources yet.</p> : sources.map((source) => (
                    <div key={source.id} className="border-t border-neutral-100 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold">{source.label}</div>
                          <div className="mt-1 truncate text-xs text-neutral-500">{source.url}</div>
                          {source.last_error && <div className="mt-2 text-xs text-amber-700">{source.last_error}</div>}
                        </div>
                        <button onClick={() => removeSource(source.id)} className="text-xs text-neutral-400 hover:text-red-600">Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <section>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">3 / Review queue</div>
                  <h2 className="mt-2 font-serif text-2xl">Comments waiting for you</h2>
                </div>
                <span className="text-xs text-neutral-400">{drafts.length} draft{drafts.length === 1 ? "" : "s"}</span>
              </div>

              <div className="mt-5 space-y-5">
                {drafts.length === 0 ? (
                  <div className="border border-dashed border-neutral-300 p-8 text-sm leading-6 text-neutral-500">No drafts yet. Add a direct LinkedIn post URL and choose <strong>Check now</strong>.</div>
                ) : drafts.map((draft) => (
                  <article key={draft.id} className="border border-neutral-200 bg-white p-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold">{draft.author || "LinkedIn post"}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.12em] text-neutral-400">Needs review</div>
                      </div>
                      <a href={draft.post_url} target="_blank" rel="noreferrer" className="text-xs font-semibold underline underline-offset-4">Open post ↗</a>
                    </div>
                    <div className="mt-5 whitespace-pre-wrap border-l-2 border-neutral-200 pl-4 text-sm leading-6 text-neutral-600">{draft.post_text}</div>
                    <div className="mt-6">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">CommentCraft draft</div>
                      <textarea
                        value={draft.comment_text}
                        onChange={(e) => setDrafts((current) => current.map((item) => item.id === draft.id ? { ...item, comment_text: e.target.value } : item))}
                        rows={6}
                        placeholder="Generate a thoughtful comment..."
                        className="mt-3 w-full resize-y border border-neutral-200 bg-[#fafaf8] p-4 text-sm leading-6 outline-none focus:border-neutral-900"
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-4">
                        <button onClick={() => generateComment(draft.id)} disabled={generating === draft.id} className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{generating === draft.id ? "Thinking..." : draft.comment_text ? "Regenerate" : "Generate comment →"}</button>
                        <button onClick={() => saveDraft(draft.id, draft.comment_text)} className="rounded-full border border-neutral-300 px-4 py-2.5 text-xs font-semibold hover:border-neutral-900">Save review draft</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {message && <div className="mt-8 border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600">{message}</div>}
        </section>
      </div>
    </main>
  );
}
