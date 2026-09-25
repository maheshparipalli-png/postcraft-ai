"use client";

import { useState } from "react";
import { normalizeGeneratedText } from "@/lib/text/normalize-generated";
import Link from "next/link";
import { useRouter } from "next/navigation";

type AssistantAction = "idea" | "improve" | "rewrite" | "shorten" | "engage";

const actions: { id: AssistantAction; title: string; description: string }[] = [
  { id: "idea", title: "Start with an idea", description: "Turn keywords or a rough thought into a complete post." },
  { id: "improve", title: "Improve my writing", description: "Fix mistakes and improve clarity while keeping your voice." },
  { id: "rewrite", title: "Rewrite in a different style", description: "Change the tone without changing the meaning." },
  { id: "shorten", title: "Make it shorter", description: "Keep the important message and remove unnecessary words." },
  { id: "engage", title: "Make it more engaging", description: "Strengthen the opening, flow, and reader connection." },
];

export default function CreatePostPage() {
  const router = useRouter();
  const [action, setAction] = useState<AssistantAction>("idea");
  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("Thoughtful");
  const [audience, setAudience] = useState("");
  const [length, setLength] = useState("Medium");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const selectedAction = actions.find((item) => item.id === action) ?? actions[0];
  const needsDraft = action !== "idea";

  async function runAI() {
    setError("");
    setSaved(false);
    if (action === "idea" && !topic.trim()) {
      setError("Enter a topic, idea, or a few keywords first.");
      return;
    }
    if (needsDraft && !draft.trim()) {
      setError("Write or paste a draft in the editor first.");
      return;
    }

    const instructions: Record<AssistantAction, string> = {
      idea: "Create a natural LinkedIn post from the topic or keywords.",
      improve: "Correct grammar, spelling, clarity, flow, and awkward phrasing while preserving the author's meaning and voice.",
      rewrite: "Rewrite the draft in the selected writing style while preserving its central meaning and key points.",
      shorten: "Make the draft shorter and tighter. Preserve the central message, useful details, and natural voice.",
      engage: "Make the draft more engaging by strengthening the opening, structure, specificity, and reader connection. Avoid clickbait and generic motivational language.",
    };

    const input = action === "idea"
      ? `Topic or keywords: ${topic}`
      : `Draft to work on:\n${draft}${topic.trim() ? `\n\nAdditional context: ${topic}` : ""}`;
    const prompt = `${instructions[action]}\nWriting style: ${style}\nTarget audience: ${audience || "professionals"}\nDesired length: ${length}\n${input}\n\nReturn only the finished post. Do not add a title, explanation, quotation marks, or hashtags unless they genuinely fit. Make it sound human and specific, not generic or over-polished.`;

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
      setDraft(normalizeGeneratedText(data.text, { plainPunctuation: true }));
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
          <button type="button" onClick={() => router.push("/")} className="text-sm text-neutral-500 hover:text-black dark:hover:text-white">{'<- Back to workspace'}</button>
          <nav className="mt-5 flex flex-wrap gap-4 text-xs text-neutral-500" aria-label="Main navigation">
            <Link href="/">Home</Link><Link href="/auto-post">Auto-post</Link><Link href="/commentcraft/import">CommentCraft</Link><Link href="/workspace">Workspace</Link>
          </nav>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">Create a post</h1>
          <p className="mt-2 text-sm text-neutral-500">What would you like to do? Start with an idea, improve your writing, or reshape an existing draft.</p>
        </header>

        <div className="mt-8 grid gap-8 lg:grid-cols-[380px_1fr]">
          <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-950">
            <h2 className="text-lg font-semibold">AI writing assistant</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-500">Choose an action and let AI help with the next step.</p>

            <div className="mt-5 space-y-2">
              {actions.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setAction(item.id); setError(""); }}
                  className={`w-full rounded-xl border p-3 text-left transition ${action === item.id ? "border-black bg-black/[0.04] dark:border-white dark:bg-white/[0.08]" : "border-black/10 hover:bg-black/[0.03] dark:border-white/10 dark:hover:bg-white/[0.04]"}`}
                >
                  <span className="flex items-center justify-between gap-3 text-sm font-medium"><span>{item.title}</span>{action === item.id && <span aria-hidden="true">OK</span>}</span>
                  <span className="mt-1 block text-xs leading-5 text-neutral-500">{item.description}</span>
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-5 border-t border-black/10 pt-6 dark:border-white/10">
              <label className="block text-sm font-medium">{action === "idea" ? "Topic, idea, or keywords" : "Context or additional direction (optional)"}
                <textarea value={topic} onChange={(event) => setTopic(event.target.value)} placeholder={action === "idea" ? "AI, leadership, hiring, lessons from building a startup..." : "Add context or tell AI what you want to change..."} rows={4} className="mt-2 w-full resize-none rounded-lg border border-black/15 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15" />
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
              <button type="button" onClick={runAI} disabled={busy} className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-black">{busy ? "AI is working..." : `${selectedAction.title} ->`}</button>
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-neutral-950">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Draft editor</h2><p className="mt-1 text-sm text-neutral-500">Write directly or paste a draft here. You can edit every AI result before saving.</p></div><span className="rounded-full bg-black/5 px-3 py-1 text-xs text-neutral-500 dark:bg-white/10">{length} - {style}</span></div>
            {error && <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
            <textarea value={draft} onChange={(event) => { setDraft(event.target.value); setSaved(false); }} placeholder={action === "idea" ? "Your AI-generated post will appear here. You can also write directly." : "Paste or write your draft here, then use the selected AI action."} rows={18} className="mt-6 w-full resize-y rounded-xl border border-black/15 bg-transparent px-4 py-4 text-base leading-7 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15" />
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-neutral-500">{draft.length} characters</p><div className="flex flex-wrap gap-3"><button type="button" onClick={handleClear} className="rounded-lg border border-black/15 px-4 py-2.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">Clear</button><button type="button" onClick={handleSaveDraft} disabled={!draft.trim()} className="rounded-lg bg-black px-4 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black">Save draft</button></div></div>
            {saved && <p className="mt-4 text-sm text-green-600">Draft saved locally in this browser.</p>}
          </section>
        </div>
      </div>
    </main>
  );
}





