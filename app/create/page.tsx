"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "generate" | "improve";

export default function CreatePostPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Thoughtful");
  const [audience, setAudience] = useState("");
  const [length, setLength] = useState("Medium");
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<Mode>("generate");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function runAI() {
    setError("");
    setSaved(false);
    if (mode === "generate" && !topic.trim()) {
      setError("Enter a topic, idea, or a few keywords first.");
      return;
    }
    if (mode === "improve" && !draft.trim()) {
      setError("Write or paste a draft first so AI can improve it.");
      return;
    }

    const prompt = mode === "generate"
      ? `Create a natural LinkedIn post from the following inputs.\nTopic or keywords: ${topic}\nWriting style: ${style}\nTarget audience: ${audience || "professionals"}\nDesired length: ${length}\nReturn only the finished post. Do not add a title, explanation, quotation marks, or hashtags unless they genuinely fit.`
      : `Improve the following LinkedIn draft. Correct grammar, spelling, clarity, flow, and awkward phrasing while preserving the author's meaning and voice. Make it sound human and natural, not generic or over-polished. Writing style: ${style}. Target audience: ${audience || "professionals"}. Desired length: ${length}. Return only the revised post.\n\nDraft:\n${draft}`;

    setBusy(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", prompt }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.text !== "string") {
        throw new Error(data?.error || "AI could not complete the request.");
      }
      setDraft(data.text.trim());
      setSaved(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI could not complete the request.");
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    setTopic("");
    setAudience("");
    setDraft("");
    setSaved(false);
    setError("");
  }

  function handleSaveDraft() {
    try {
      window.localStorage.setItem("postcraft-manual-draft", draft);
      setSaved(true);
    } catch {
      setError("The draft could not be saved in this browser.");
    }
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-8 dark:bg-black">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-black/10 pb-6 dark:border-white/10">
          <button type="button" onClick={() => router.push("/")} className="text-sm text-neutral-500 hover:text-black dark:hover:text-white">← Back to workspace</button>
          <nav className="mt-5 flex flex-wrap gap-4 text-xs text-neutral-500" aria-label="Main navigation">
            <a href="/">Home</a><a href="/auto-post">Auto-post</a><a href="/commentcraft/import">CommentCraft</a><a href="/workspace">Workspace</a>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Create a post</h1>
          <p className="mt-2 text-sm text-neutral-500">Start with keywords or your own draft. Let AI help you find the words without losing your voice.</p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-950">
            <h2 className="text-lg font-semibold">AI writing assistant</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Choose how you want to work.</p>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-black/5 p-1 dark:bg-white/10">
              <button type="button" onClick={() => setMode("generate")} className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === "generate" ? "bg-white shadow-sm dark:bg-neutral-800" : "text-neutral-500"}`}>Generate</button>
              <button type="button" onClick={() => setMode("improve")} className={`rounded-lg px-3 py-2 text-sm font-medium ${mode === "improve" ? "bg-white shadow-sm dark:bg-neutral-800" : "text-neutral-500"}`}>Improve draft</button>
            </div>

            <div className="mt-6 space-y-5">
              <label className="block text-sm font-medium">{mode === "generate" ? "Topic, idea, or keywords" : "Optional topic or context"}
                <textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={mode === "generate" ? "AI, leadership, hiring, lessons from building a startup..." : "Add context to help AI understand the draft..."} rows={5} className="mt-2 w-full resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15" />
              </label>
              <label className="block text-sm font-medium">Writing style
                <select value={style} onChange={(event) => setStyle(event.target.value)} className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm dark:border-white/15"><option>Thoughtful</option><option>Professional</option><option>Conversational</option><option>Bold</option><option>Storytelling</option><option>Analytical</option></select>
              </label>
              <label className="block text-sm font-medium">Target audience
                <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="For example: founders, HR leaders" className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15" />
              </label>
              <label className="block text-sm font-medium">Desired length
                <select value={length} onChange={(event) => setLength(event.target.value)} className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm dark:border-white/15"><option>Short</option><option>Medium</option><option>Long</option></select>
              </label>
              <button type="button" onClick={runAI} disabled={busy} className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black">{busy ? "AI is working…" : mode === "generate" ? "Generate post with AI →" : "Improve my draft →"}</button>
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Draft editor</h2><p className="mt-1 text-sm text-neutral-500">You stay in control. Edit the result before saving or publishing.</p></div><span className="rounded-full bg-black/5 px-3 py-1 text-xs text-neutral-500 dark:bg-white/10">{length} · {style}</span></div>
            {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
            <textarea value={draft} onChange={(event) => { setDraft(event.target.value); setSaved(false); }} placeholder={mode === "generate" ? "Your AI-generated post will appear here. You can also write directly." : "Paste your draft here, then ask AI to improve it."} rows={18} className="mt-6 w-full resize-y rounded-xl border border-black/15 bg-transparent px-4 py-4 text-base leading-7 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15" />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-neutral-500">{draft.length} characters</p><div className="flex flex-wrap gap-3"><button type="button" onClick={handleClear} className="rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">Clear</button><button type="button" onClick={handleSaveDraft} disabled={!draft.trim()} className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black">Save draft</button></div></div>
            {saved && <p className="mt-4 text-sm text-green-600">Draft saved locally in this browser.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}
