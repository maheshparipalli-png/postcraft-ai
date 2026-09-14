"use client";
import Link from "next/link";
import { useState } from "react";

const presets = [
  ["thoughtful", "Thoughtful", "Insightful and reflective"],
  ["practical", "Practical", "Useful and actionable"],
  ["contrarian", "Contrarian", "Respectfully challenges the idea"],
  ["supportive", "Supportive", "Positive and concise"],
  ["question-led", "Question-led", "Encourages discussion"],
];

export default function CommentcraftImportPage() {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [summary, setSummary] = useState("");
  const [idea, setIdea] = useState("");
  const [preset, setPreset] = useState("thoughtful");
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function generateSummary() {
    if (!text.trim()) {
      setMessage("Paste the post text before generating a summary.");
      return;
    }

    setSummaryLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/commentcraft/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postText: text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate a summary.");
      setSummary(data.summary || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Summary generation failed.");
    } finally {
      setSummaryLoading(false);
    }
  }

  function clearForm() {
    setUrl("");
    setText("");
    setSummary("");
    setIdea("");
    setPreset("thoughtful");
    setMessage("");
  }

  async function submit() {
    if (!url.trim() && !text.trim()) {
      setMessage("Add a LinkedIn URL or paste the post text.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/commentcraft/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: url, postText: text, summary, preset, userIdea: idea }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not import the post.");
      window.location.href = `/commentcraft/queue/${data.post.id}`;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6">
          <div>
            <Link href="/" className="font-serif text-[22px] font-semibold">POSTCRAFT</Link>
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">CommentCraft</div>
          </div>
          <nav className="flex flex-wrap gap-4 text-xs">
            <Link href="/" className="text-neutral-600 hover:text-black">Home</Link>
            <Link href="/create" className="text-neutral-600 hover:text-black">Write</Link>
            <Link href="/auto-post" className="text-neutral-600 hover:text-black">Auto-post</Link>
            <Link href="/commentcraft/queue" className="text-neutral-600 hover:text-black">Review queue</Link>
            <Link href="/workspace" className="text-neutral-600 hover:text-black">Workspace</Link>
          </nav>
        </header>

        <section className="border-b border-neutral-300/80 py-14">
          <div className="max-w-3xl">
            <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Manual post import</div>
            <h1 className="mt-5 font-serif text-5xl leading-[.98] tracking-[-.045em] sm:text-7xl">Write better LinkedIn comments<br />in seconds.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600">Understand the post, choose your tone, and create thoughtful comments that sound like you.</p>
          </div>
        </section>

        <section className="grid gap-10 py-10 lg:grid-cols-[1fr_320px]">
          <div className="space-y-9">
            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">1</span>
                <div>
                  <h2 className="font-serif text-2xl">Add the post</h2>
                  <p className="text-sm text-neutral-500">Use a URL first, or paste the text directly.</p>
                </div>
              </div>
              <div className="space-y-6 border-l border-neutral-300 pl-10">
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[.14em] text-neutral-500">LinkedIn post URL</span>
                  <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://www.linkedin.com/posts/..." className="mt-3 w-full border-b border-neutral-400 bg-transparent px-0 py-3 text-sm outline-none focus:border-black" />
                  <span className="mt-2 block text-xs text-neutral-500">If LinkedIn content cannot be retrieved, paste the post text below.</span>
                </label>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[.14em] text-neutral-500">Post text</span>
                  <textarea value={text} onChange={e => setText(e.target.value)} rows={10} placeholder="Paste the post text here if necessary..." className="mt-3 w-full border border-neutral-300 bg-white/40 p-4 text-sm leading-6 outline-none focus:border-black" />
                  <span className="mt-2 block text-xs text-neutral-500">The pasted text is the source of truth for analysis.</span>
                </label>
              </div>
            </div>

            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">2</span>
                <div>
                  <h2 className="font-serif text-2xl">Guide the AI</h2>
                  <p className="text-sm text-neutral-500">Give the model context, direction, or your own angle.</p>
                </div>
              </div>
              <div className="space-y-6 border-l border-neutral-300 pl-10">
                <div>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-medium uppercase tracking-[.14em] text-neutral-500">Post summary <span className="normal-case tracking-normal text-neutral-400">(optional)</span></span>
                    <span className="text-xs text-neutral-500">AI-generated and editable</span>
                  </div>
                  <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={4} placeholder="Generate a short summary or write your own..." className="mt-3 w-full border border-neutral-300 bg-white/40 p-4 text-sm leading-6 outline-none focus:border-black" />
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button type="button" disabled={summaryLoading || !text.trim()} onClick={generateSummary} className="border border-neutral-900 px-4 py-2 text-xs font-medium text-neutral-900 transition hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">{summaryLoading ? "Creating summary…" : "Generate summary"}</button>
                    <span className="text-xs text-neutral-500">Paste the post text above to enable this button.</span>
                  </div>
                </div>
                <label className="block">
                  <span className="text-xs font-medium uppercase tracking-[.14em] text-neutral-500">Your keyword or idea <span className="normal-case tracking-normal text-neutral-400">(optional)</span></span>
                  <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={3} placeholder="Example: privilege should create gratitude, not guilt" className="mt-3 w-full border border-neutral-300 bg-white/40 p-4 text-sm leading-6 outline-none focus:border-black" />
                  <span className="mt-2 block text-xs text-neutral-500">One of the four comments will use this idea as its main angle.</span>
                </label>
              </div>
            </div>

            <div>
              <div className="mb-5 flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs text-white">3</span>
                <div>
                  <h2 className="font-serif text-2xl">Generate and review</h2>
                  <p className="text-sm text-neutral-500">Choose a style, then review four distinct comment options.</p>
                </div>
              </div>
              <div className="border-l border-neutral-300 pl-10">
                {message && <p className="mb-4 text-sm text-red-700">{message}</p>}
                <div className="flex flex-wrap items-center gap-4">
                  <button disabled={loading} onClick={submit} className="bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Generating four options…" : "Generate 4 comment options →"}</button>
                  <button type="button" onClick={clearForm} className="px-2 py-3 text-sm text-neutral-500 underline decoration-neutral-300 underline-offset-4 hover:text-black">Clear form</button>
                </div>
                <p className="mt-4 max-w-lg text-xs leading-5 text-neutral-500">Your post will be saved to the review queue, where you can edit, approve, or regenerate each comment.</p>
              </div>
            </div>
          </div>

          <aside className="border-t border-neutral-300 pt-6 lg:border-l lg:border-t-0 lg:pl-8">
            <div className="text-xs font-medium uppercase tracking-[.14em] text-neutral-500">Comment style</div>
            <div className="mt-4 space-y-2">
              {presets.map(([value, label, description]) => (
                <label key={value} className={`block cursor-pointer border p-3 transition ${preset === value ? "border-neutral-900 bg-white" : "border-neutral-300 bg-transparent hover:border-neutral-500"}`}>
                  <input type="radio" name="preset" value={value} checked={preset === value} onChange={e => setPreset(e.target.value)} className="sr-only" />
                  <span className="flex items-start gap-3">
                    <span className={`mt-0.5 h-3.5 w-3.5 rounded-full border ${preset === value ? "border-neutral-900 bg-neutral-900 ring-2 ring-neutral-900 ring-offset-2" : "border-neutral-400"}`} />
                    <span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-neutral-500">{description}</span></span>
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-6 text-sm leading-6 text-neutral-600">Choose the writing direction that best fits the conversation. You can still edit every generated comment before using it.</p>
          </aside>
        </section>
      </div>
    </main>
  );
}
