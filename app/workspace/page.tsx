"use client";

import Link from "next/link";
import { useState } from "react";

type Idea = { title: string; description: string; whyItMatters: string; sourceIndexes: number[]; source: string; url: string; publishedAt: string };
type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type Angle = { text: string; why: string; evidence: string };

const perspectives = [
  { id: "agree", label: "I agree", description: "Build on the argument." },
  { id: "disagree", label: "I disagree", description: "Challenge the argument." },
  { id: "mixed", label: "It is more complicated", description: "Add a missing distinction." },
  { id: "curious", label: "I am not sure yet", description: "Explore the unresolved question." },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function Workspace() {
  const [idea, setIdea] = useState<Idea | null>(null);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [angles, setAngles] = useState<Angle[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [angle, setAngle] = useState("");
  const [perspective, setPerspective] = useState("mixed");
  const [perspectiveNote, setPerspectiveNote] = useState("");
  const [post, setPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [angleLoading, setAngleLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState("");

  async function discover() {
    setLoading(true); setError(""); setIdeas([]); setIdea(null); setAngles([]); setAngle(""); setPost("");
    try {
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "PostCraft Recommended" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Discovery failed");
      setIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Discovery failed"); }
    finally { setLoading(false); }
  }

  async function selectIdea(value: Idea) {
    setIdea(value); setAngles([]); setEvidence([]); setAngle(""); setPost(""); setError(""); setAngleLoading(true);
    try {
      const prompt = `You are PostCraft AI, an editorial thinking partner. Analyze this exact news story and its source article. Find three distinct, evidence-led LinkedIn angles. Do not rely on outside knowledge. Return ONLY valid JSON with objects containing angle, why, and evidence.\n\nTopic: PostCraft Recommended\nHeadline: ${value.title}\nSource: ${value.source}\nURL: ${value.url}\nSummary: ${value.description || "No reliable summary was supplied."}`;
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "angles", prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Angle generation failed");
      let parsed: unknown;
      try { parsed = JSON.parse(data.text); } catch { const match = String(data.text).match(/\[[\s\S]*\]/); if (!match) throw new Error("AI returned an invalid angle list"); parsed = JSON.parse(match[0]); }
      const nextAngles = Array.isArray(parsed) ? parsed.map((item) => {
        if (!item || typeof item !== "object") return null;
        const value = item as { angle?: unknown; why?: unknown; evidence?: unknown };
        if (typeof value.angle !== "string") return null;
        return { text: value.angle.trim(), why: typeof value.why === "string" ? value.why.trim() : "", evidence: typeof value.evidence === "string" ? value.evidence.trim() : "" };
      }).filter((item): item is Angle => Boolean(item?.text)).slice(0, 3) : [];
      if (!nextAngles.length) throw new Error("AI could not find a useful angle for this story");
      setAngles(nextAngles); setAngle(nextAngles[0].text); setEvidence(Array.isArray(data?.evidence) ? data.evidence : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Angle generation failed"); }
    finally { setAngleLoading(false); }
  }

  async function createPost() {
    if (!idea || !angle) return;
    setPostLoading(true); setError("");
    const selectedPerspective = perspectives.find((item) => item.id === perspective);
    const prompt = `You are PostCraft AI. Turn ONE news development and ONE selected angle into a LinkedIn post. The user's perspective is editorial guidance, not evidence.\n\nTopic: PostCraft Recommended\nHeadline: ${idea.title}\nSource: ${idea.source}\nURL: ${idea.url}\nSummary: ${idea.description || "No reliable summary was supplied."}\nSelected angle: ${angle}\nWhy this angle works: ${angles.find((item) => item.text === angle)?.why || ""}\nPerspective: ${selectedPerspective?.label}\nPerspective guidance: ${selectedPerspective?.description}\nUser's own note: ${perspectiveNote || "No additional note supplied."}\nEvidence JSON: ${JSON.stringify(evidence)}\n\nRules: Ground factual claims only in the supplied evidence. Do not invent personal experience, examples, statistics, motives, or outside context. Keep the selected angle intact. Make the thesis clear early. Use plain language and natural sentence rhythm. Avoid generic phrases such as "raises important questions", "future of work", "need to strike a balance", or "in today's rapidly changing world". Do not add a generic policy conclusion. Return the post as plain text only.`;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Post generation failed");
      let value = typeof data?.text === "string" ? data.text : "";
      try { const parsed = JSON.parse(value); value = typeof parsed?.post === "string" ? parsed.post : value; } catch { value = value.replace(/^```(?:json|text|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim(); }
      if (!value.trim()) throw new Error("AI returned an empty post");
      setPost(value.trim());
    } catch (err) { setError(err instanceof Error ? err.message : "Post generation failed"); }
    finally { setPostLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-neutral-200/80 pb-5"><Link href="/" className="text-lg font-semibold tracking-tight">POSTCRAFT <span className="text-neutral-400">AI</span><div className="mt-0.5 text-xs font-normal text-neutral-500">Editorial workspace</div></Link><Link href="/" className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:border-neutral-400">Back to Discover</Link></header>

        <section className="mx-auto max-w-4xl pb-8 pt-14 sm:pt-18"><div className="inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500">A focused place to develop one idea</div><h1 className="mt-5 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Bring your point of view into the post.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-neutral-500">PostCraft finds the story and evidence. You decide what you actually think.</p><button onClick={discover} disabled={loading} className="mt-6 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-40">{loading ? "Finding stories…" : "Find a story to work on"}</button></section>

        {ideas.length > 0 && <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-7"><div className="flex items-center justify-between"><div><div className="text-sm font-semibold">Choose a story</div><div className="mt-1 text-sm text-neutral-500">Pick one worth having an opinion about.</div></div><div className="text-xs text-neutral-400">{ideas.length} stories</div></div><div className="mt-5 grid gap-3">{ideas.map((item) => <button key={item.url} onClick={() => selectIdea(item)} className={`w-full rounded-2xl border p-5 text-left transition ${idea?.url === item.url ? "border-neutral-900 bg-neutral-950 text-white shadow-lg" : "border-neutral-200 bg-neutral-50/40 hover:border-neutral-400 hover:bg-white"}`}><div className={`text-xs ${idea?.url === item.url ? "text-neutral-400" : "text-neutral-400"}`}>{item.source}{item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}</div><div className="mt-2 text-base font-semibold leading-6">{item.title}</div>{item.description && <div className={`mt-2 text-sm leading-6 ${idea?.url === item.url ? "text-neutral-300" : "text-neutral-600"}`}>{item.description}</div>}</button>)}</div></section>}

        {idea && <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-7">
          <div className="flex items-center justify-between"><div><div className="text-sm font-semibold">01 · Choose your angle</div><p className="mt-1 text-sm text-neutral-500">Three grounded ways into the story. Choose the one you want to argue.</p></div></div>
          {angleLoading ? <div className="mt-5 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">Reading the source and finding grounded angles…</div> : <div className="mt-5 grid gap-3 lg:grid-cols-3">{angles.map((item, index) => <button key={item.text} onClick={() => { setAngle(item.text); setPost(""); }} className={`rounded-2xl border p-5 text-left transition ${angle === item.text ? "border-neutral-900 bg-neutral-950 text-white shadow-lg" : "border-neutral-200 bg-neutral-50/40 hover:border-neutral-400 hover:bg-white"}`}><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Angle {index + 1}</div><div className="mt-2 text-sm font-semibold leading-6">{item.text}</div>{item.why && <div className={`mt-3 text-xs leading-5 ${angle === item.text ? "text-neutral-300" : "text-neutral-500"}`}>{item.why}</div>}{item.evidence && <div className={`mt-4 border-t pt-3 text-xs leading-5 ${angle === item.text ? "border-neutral-700 text-neutral-300" : "border-neutral-200 text-neutral-500"}`}><span className="font-semibold">Evidence</span><div className="mt-1">{item.evidence}</div></div>}</button>)}</div>}

          <div className="mt-9 border-t border-neutral-100 pt-8"><div className="text-sm font-semibold">02 · What’s your take?</div><p className="mt-1 text-sm text-neutral-500">This is the part PostCraft should never invent for you.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{perspectives.map((item) => <button key={item.id} onClick={() => setPerspective(item.id)} disabled={!angle} className={`rounded-2xl border p-4 text-left transition ${perspective === item.id ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-neutral-50/40 hover:border-neutral-400 hover:bg-white"} disabled:cursor-not-allowed disabled:opacity-50`}><div className="text-sm font-semibold">{item.label}</div><div className={`mt-1 text-xs leading-5 ${perspective === item.id ? "text-neutral-300" : "text-neutral-500"}`}>{item.description}</div></button>)}</div><textarea value={perspectiveNote} onChange={(event) => setPerspectiveNote(event.target.value)} disabled={!angle} placeholder="Optional: write the thought you want the post to preserve…" rows={3} className="mt-4 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-6 outline-none transition focus:border-neutral-900 focus:bg-white disabled:opacity-50" /></div>

          <div className="mt-8 flex flex-col gap-3 border-t border-neutral-100 pt-6 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-semibold">03 · Create the post</div><div className="mt-1 text-xs text-neutral-400">Evidence + angle + your point of view.</div></div><button onClick={createPost} disabled={postLoading || angleLoading || !angle} className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">{postLoading ? "Writing…" : "Create LinkedIn post"}</button></div>
        </section>}

        {post && <section className="mt-8 rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-7"><div className="flex items-center justify-between"><div><div className="text-sm font-semibold">Your post</div><div className="mt-1 text-sm text-neutral-500">Review the argument before you publish it.</div></div><div className="text-xs text-neutral-400">04</div></div><div className="mt-5 whitespace-pre-wrap rounded-2xl bg-neutral-50 p-6 text-[15px] leading-7 text-neutral-800">{post}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(post)} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">Copy post</button><button onClick={createPost} disabled={postLoading} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-40">Regenerate from my take</button></div></section>}

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <footer className="py-12 text-center text-xs text-neutral-400">PostCraft AI · Find something worth saying.</footer>
      </div>
    </main>
  );
}
