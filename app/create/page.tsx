"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AssistantAction = "idea" | "improve" | "rewrite" | "shorten" | "engage";

const actions: { id: AssistantAction; title: string; description: string }[] = [
  { id: "idea", title: "Build a post from my idea", description: "Turn rough thoughts, notes, or a short sentence into a complete post." },
  { id: "improve", title: "Improve my writing", description: "Make your draft clearer while keeping your voice." },
  { id: "rewrite", title: "Change the writing style", description: "Adjust the tone without changing the meaning." },
  { id: "shorten", title: "Make it shorter", description: "Keep the message and remove unnecessary words." },
  { id: "engage", title: "Make it more engaging", description: "Strengthen the opening, flow, and reader connection." },
];

export default function CreatePostPage() {
  const router = useRouter();
  const [action, setAction] = useState<AssistantAction>("idea");
  const [idea, setIdea] = useState("");
  const [style, setStyle] = useState("Thoughtful");
  const [audience, setAudience] = useState("");
  const [length, setLength] = useState("Medium");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  async function runAI() {
    setError("");
    setSaved(false);
    if (!idea.trim()) {
      setError(action === "idea" ? "Add a thought, idea, or a few rough sentences first." : "Add your draft or idea first.");
      return;
    }

    const instructions: Record<AssistantAction, string> = {
      idea: "Turn the user's raw thought into a complete, natural LinkedIn post. Treat the input as the core idea, not as a rigid outline. Preserve the author's point of view and intended meaning. Add structure and explanation only where useful. Do not invent personal experiences, statistics, facts, or claims.",
      improve: "Improve the supplied LinkedIn draft for grammar, clarity, flow, and readability while preserving its meaning and voice.",
      rewrite: "Rewrite the supplied LinkedIn draft in the selected writing style while preserving its central meaning and key points.",
      shorten: "Make the supplied LinkedIn draft shorter and tighter. Preserve its central message and natural voice.",
      engage: "Make the supplied LinkedIn draft more engaging by improving the opening, flow, specificity, and reader connection. Avoid clickbait and generic motivational language.",
    };
    const prompt = `${instructions[action]}
Writing style: ${style}
Target audience: ${audience.trim() || "professionals"}
Desired length: ${length}
Raw idea or draft:
${idea}

Write in natural, simple language. Let the idea determine the structure; do not force a fixed formula. Avoid generic openings, filler, and unnecessary hashtags. Return only the finished post, without an explanation or title.`;

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
    setIdea("");
    setDraft("");
    setAudience("");
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

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(draft);
      setError("");
    } catch {
      setError("Could not copy automatically. Select the post text and copy it.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-4 py-5 text-[#24251f] dark:bg-neutral-950 dark:text-neutral-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dedbd3] pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">POSTCRAFT</Link>
            <span className="hidden text-[#b4afa4] sm:inline">/</span>
            <span className="hidden text-sm text-neutral-500 sm:inline">Editorial studio</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500" aria-label="Main navigation">
            <Link href="/">Discover</Link>
            <Link href="/ideas">Idea Radar</Link>
            <span className="font-semibold text-[#24251f] dark:text-white">Write</span>
            <Link href="/visual-studio">Visual Studio</Link>
            <Link href="/workspace">Workspace</Link>
          </nav>
          <button type="button" onClick={() => router.push("/")} className="rounded-full border border-[#d8d4cb] px-4 py-2 text-sm hover:bg-white dark:border-white/15 dark:hover:bg-white/5">Back to workspace</button>
        </header>

        <section className="mx-auto max-w-4xl py-8 text-center sm:py-11">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#8b795c]">Your editorial desk</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">Start with a thought.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400 sm:text-lg">
            A rough idea is enough. Shape it into a LinkedIn post that sounds like you.
          </p>
        </section>

        {error && <div role="alert" className="mx-auto mb-5 max-w-6xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <section className="rounded-2xl border border-[#e2ded5] bg-white p-5 shadow-[0_8px_30px_rgba(45,39,27,0.035)] dark:border-white/10 dark:bg-neutral-900 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b795c]">01 / The idea</p>
                <h2 className="mt-2 font-serif text-2xl">Your raw thought</h2>
              </div>
              <span className="rounded-full bg-[#f2efe8] px-3 py-1 text-xs text-[#75664e] dark:bg-white/10 dark:text-neutral-300">No perfect wording needed</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-500">Type a thought, opinion, lesson, question, or a few unfinished sentences. Keep it in your own words.</p>
            <label htmlFor="raw-idea" className="sr-only">Your raw thought or draft</label>
            <textarea id="raw-idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder={"Example:\nWe talk a lot about using AI to save time. But if we use that time to create more noise, have we really improved anything?\n\nMy thought: productivity should give us room to think, not just more work."} rows={10} className="mt-5 w-full resize-y rounded-xl border border-[#e3dfd6] bg-[#fdfcf9] px-4 py-4 text-base leading-7 outline-none transition placeholder:text-neutral-400 focus:border-[#9c8b6e] focus:ring-2 focus:ring-[#9c8b6e]/15 dark:border-white/15 dark:bg-neutral-950 dark:placeholder:text-neutral-600" />
            <div className="mt-2 flex items-center justify-between text-xs text-neutral-400"><span>Fragments and short sentences are welcome.</span><span>{idea.length} chars</span></div>

            <button type="button" onClick={() => setShowOptions((value) => !value)} className="mt-6 flex w-full items-center justify-between border-t border-[#e8e4dc] pt-5 text-left text-sm font-medium dark:border-white/10">
              <span>Writing preferences <span className="ml-2 font-normal text-neutral-400">Optional</span></span><span aria-hidden="true">{showOptions ? "−" : "+"}</span>
            </button>
            {showOptions && <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">Voice
                <select value={style} onChange={(event) => setStyle(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dedbd3] bg-white px-3 py-2.5 text-sm dark:border-white/15 dark:bg-neutral-950"><option>Thoughtful</option><option>Professional</option><option>Conversational</option><option>Bold</option><option>Storytelling</option><option>Analytical</option></select>
              </label>
              <label className="block text-sm font-medium">Post length
                <select value={length} onChange={(event) => setLength(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dedbd3] bg-white px-3 py-2.5 text-sm dark:border-white/15 dark:bg-neutral-950"><option>Short</option><option>Medium</option><option>Long</option></select>
              </label>
              <label className="block text-sm font-medium sm:col-span-2">Who are you writing for?
                <input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="For example: founders, team leaders, fellow professionals" className="mt-2 w-full rounded-lg border border-[#dedbd3] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#9c8b6e] dark:border-white/15 dark:bg-neutral-950" />
              </label>
              <label className="block text-sm font-medium sm:col-span-2">What kind of help do you want?
                <select value={action} onChange={(event) => setAction(event.target.value as AssistantAction)} className="mt-2 w-full rounded-lg border border-[#dedbd3] bg-white px-3 py-2.5 text-sm dark:border-white/15 dark:bg-neutral-950">{actions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
              </label>
            </div>}
            <button type="button" onClick={runAI} disabled={busy || !idea.trim()} className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#292a24] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#414239] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
              {busy ? <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-neutral-500 dark:border-t-neutral-900" />Shaping your thought…</> : <>Build my LinkedIn post <span aria-hidden="true">→</span></>}
            </button>
            <p className="mt-3 text-center text-xs text-neutral-400">Your idea stays yours. Review and edit every line before using it.</p>
          </section>

          <section className="rounded-2xl border border-[#e2ded5] bg-[#eeece5] p-4 dark:border-white/10 dark:bg-neutral-900 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b795c]">02 / The draft</p>
                <h2 className="mt-2 font-serif text-2xl">Your LinkedIn post</h2>
                <p className="mt-1 text-sm text-neutral-500">Generated draft, ready for your edits.</p>
              </div>
              <span className="rounded-full border border-[#d7d2c7] px-3 py-1 text-xs text-neutral-500 dark:border-white/15">{length} · {style}</span>
            </div>
            <div className="rounded-2xl border border-[#e5e2dc] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-950 sm:p-7">
              <div className="flex items-center gap-3 border-b border-[#eeece7] pb-4 dark:border-white/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8e0d1] font-serif text-lg text-[#69583e]">P</div>
                <div><p className="text-sm font-semibold">Your LinkedIn post</p><p className="text-xs text-neutral-400">Preview · Only you can see this draft here</p></div>
              </div>
              <label htmlFor="post-draft" className="sr-only">Edit your generated LinkedIn post</label>
              <textarea id="post-draft" value={draft} onChange={(event) => { setDraft(event.target.value); setSaved(false); }} placeholder="Your post will appear here. Start with your thought on the left, then select “Build my LinkedIn post”. You can edit the result directly in this space." rows={15} className="mt-5 min-h-[340px] w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-7 outline-none placeholder:text-neutral-400 focus:ring-0 dark:placeholder:text-neutral-600" />
              <div className="mt-3 flex items-center justify-between border-t border-[#eeece7] pt-4 text-xs text-neutral-400 dark:border-white/10"><span>{draft.trim() ? draft.trim().split(/\s+/).length : 0} words</span><span>{draft.length} characters</span></div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={runAI} disabled={busy || !idea.trim()} className="rounded-lg border border-[#d7d2c7] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[#faf9f6] disabled:opacity-50 dark:border-white/15 dark:bg-neutral-950">Regenerate</button>
              <button type="button" onClick={() => { setAction("shorten"); void runAI(); }} disabled={busy || !draft.trim()} className="rounded-lg border border-[#d7d2c7] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[#faf9f6] disabled:opacity-50 dark:border-white/15 dark:bg-neutral-950">Make it shorter</button>
              <button type="button" onClick={copyDraft} disabled={!draft.trim()} className="rounded-lg bg-[#292a24] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#414239] disabled:opacity-50 dark:bg-white dark:text-neutral-900">Copy post</button>
              <button type="button" onClick={handleSaveDraft} disabled={!draft.trim()} className="rounded-lg border border-[#d7d2c7] px-4 py-2.5 text-sm font-medium hover:bg-white disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5">Save draft</button>
            </div>
            {saved && <p className="mt-3 text-sm text-green-700 dark:text-green-400">Draft saved in this browser.</p>}
            <p className="mt-4 text-xs leading-5 text-neutral-500">Take a moment to check the meaning, facts, and tone. Make it yours before publishing.</p>
          </section>
        </div>

        <section className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#e2ded5] bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
          <div className="grid gap-5 text-sm sm:grid-cols-3">
            <div><p className="font-semibold">1. Write naturally</p><p className="mt-1 leading-6 text-neutral-500">A sentence, a question, or a half-formed thought is enough.</p></div>
            <div><p className="font-semibold">2. Let AI shape it</p><p className="mt-1 leading-6 text-neutral-500">PostCraft helps with structure and clarity without forcing a template.</p></div>
            <div><p className="font-semibold">3. Make it yours</p><p className="mt-1 leading-6 text-neutral-500">Review, edit, and copy your post when it feels right.</p></div>
          </div>
        </section>
        <footer className="py-7 text-center text-xs text-neutral-400">PostCraft · Your ideas, in your voice.</footer>
      </div>
    </main>
  );
}
