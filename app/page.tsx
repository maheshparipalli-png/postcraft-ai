"use client";

import Link from "next/link";
import { useRef, useState } from "react";

type Idea = { title: string; description: string; whyItMatters: string; sourceIndexes: number[]; source: string; url: string; publishedAt: string };
type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type AngleSuggestion = { text: string; why: string; evidence: string };
type PostMode = "default" | "regenerate" | "sharper" | "human";

const feeds = [
  { id: "AI & Technology", icon: "🤖", description: "AI, technology and the developments worth paying attention to." },
  { id: "India", icon: "🇮🇳", description: "Indian business, policy, technology and social stories worth knowing." },
  { id: "PostCraft Recommended", icon: "⭐", description: "The stories PostCraft thinks are most worth saying something about." },
];

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function cleanGeneratedPost(value: string) {
  return value.replace(/^```(?:text|markdown)?\s*/i, "").replace(/\s*```$/i, "").replace(/^\s*(LinkedIn post|Post):\s*/i, "").trim();
}

export default function Home() {
  const [topic, setTopic] = useState("PostCraft Recommended");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [angle, setAngle] = useState("");
  const [suggestedAngles, setSuggestedAngles] = useState<AngleSuggestion[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [copied, setCopied] = useState(false);
  const [angleLoading, setAngleLoading] = useState(false);
  const [post, setPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const angleRequestRef = useRef(0);
  const angleAbortRef = useRef<AbortController | null>(null);

  async function discoverIdeas() {
    setLoading(true); setError(""); setIdeas([]); setSelectedIdea(null); setSuggestedAngles([]); setEvidence([]); setAngle(""); setPost("");
    try {
      const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: selectedTopic }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Discovery failed");
      setIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Discovery failed"); }
    finally { setLoading(false); }
  }

  async function generateAngles(idea: Idea) {
    const requestId = ++angleRequestRef.current;
    angleAbortRef.current?.abort();
    const controller = new AbortController(); angleAbortRef.current = controller;
    setAngleLoading(true); setAngle(""); setError(""); setSuggestedAngles([]); setEvidence([]); setPost("");
    try {
      const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
      const prompt = `You are PostCraft AI, an editorial thinking partner.\n\nAnalyze this exact news story and the source article itself. Find thoughtful, evidence-led LinkedIn angles.\n\nTopic: ${selectedTopic}\nHeadline: ${idea.title}\nSource: ${idea.source}\nURL: ${idea.url}\nSummary: ${idea.description || "No reliable summary was supplied."}\n\nThe server will retrieve the source article and build an evidence ledger before generating angles. Do not rely on outside knowledge.\n\nReturn ONLY valid JSON. The system will return the strongest three grounded angles.`;
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "angles", prompt }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Angle generation failed");
      let parsed: unknown;
      try { parsed = JSON.parse(data.text); } catch { const match = data.text.match(/\[[\s\S]*\]/); if (!match) throw new Error("AI returned an invalid angle list"); parsed = JSON.parse(match[0]); }
      const generatedAngles: AngleSuggestion[] = Array.isArray(parsed) ? parsed.map((item): AngleSuggestion | null => {
        if (!item || typeof item !== "object") return null;
        const value = item as { angle?: unknown; why?: unknown; evidence?: unknown };
        const text = typeof value.angle === "string" ? value.angle.trim() : "";
        const why = typeof value.why === "string" ? value.why.trim() : "";
        const evidenceAnchor = typeof value.evidence === "string" ? value.evidence.trim() : "";
        return text ? { text, why, evidence: evidenceAnchor } : null;
      }).filter((item): item is AngleSuggestion => Boolean(item?.text)) : [];
      const uniqueAngles = Array.from(new Map(generatedAngles.map((item) => [item.text.toLowerCase(), item])).values()).slice(0, 3);
      if (!uniqueAngles.length) throw new Error("AI could not find a useful angle for this story");
      if (requestId !== angleRequestRef.current) return;
      setEvidence(Array.isArray(data?.evidence) ? data.evidence : []);
      setSuggestedAngles(uniqueAngles); setAngle(uniqueAngles[0].text);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (requestId === angleRequestRef.current) setError(err instanceof Error ? err.message : "Angle generation failed");
    } finally { if (requestId === angleRequestRef.current) setAngleLoading(false); }
  }

  async function createPost(mode: PostMode = "default") {
    if (!selectedIdea || !angle) return;
    setPostLoading(true); setError(""); setCopied(false);
    const selectedAngle = suggestedAngles.find((item) => item.text === angle);
    const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
    const modeInstruction = mode === "sharper"
      ? "Make the thesis more pointed. Cut safe filler and state the implication clearly. Keep every claim grounded."
      : mode === "human"
        ? "Make it sound like a smart person wrote it for another smart person. Use plain language and natural rhythm. Never manufacture a personal story."
        : mode === "regenerate"
          ? "Take a genuinely different route into the same argument. Change the opening and reasoning structure, not just the wording."
          : "Write the strongest natural version of the selected thesis.";
    const prompt = `You are PostCraft AI, an editorial thinking partner.\n\nTurn ONE news development and ONE selected angle into a LinkedIn post.\n\nTopic: ${selectedTopic}\nHeadline: ${selectedIdea.title}\nSource: ${selectedIdea.source}\nURL: ${selectedIdea.url}\nSummary: ${selectedIdea.description || "No reliable summary was supplied."}\nSelected angle: ${angle}\nWhy this angle works: ${selectedAngle?.why || "It gives the story a specific point of view."}\nEvidence JSON: ${JSON.stringify(evidence)}\n\nThe evidence JSON above was extracted from the source article during angle generation. Use it as the complete factual source. Do not invent additional context.\n\n${modeInstruction}\n\nReturn ONLY valid JSON: {"post":"the finished LinkedIn post"}`;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Post generation failed");
      const generatedPost = cleanGeneratedPost(typeof data?.text === "string" ? data.text : "");
      if (!generatedPost) throw new Error("AI returned an empty post");
      setPost(generatedPost);
    } catch (err) { setError(err instanceof Error ? err.message : "Post generation failed"); }
    finally { setPostLoading(false); }
  }

  async function copyPost() {
    if (!post) return;
    try { await navigator.clipboard.writeText(post); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError("Could not copy the post to your clipboard"); }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-950">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8 sm:py-8">
        <header className="flex items-center justify-between border-b border-neutral-200/80 pb-5">
          <Link href="/" className="group"><div className="text-lg font-semibold tracking-tight">POSTCRAFT <span className="text-neutral-400">AI</span></div><div className="mt-0.5 text-xs text-neutral-500">Find something worth saying.</div></Link>
          <nav className="flex items-center gap-3"><Link href="/workspace" className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400">Editorial workspace</Link><span className="hidden rounded-full bg-neutral-100 px-3 py-2 text-xs font-medium text-neutral-500 sm:inline-flex">Guest</span></nav>
        </header>

        <section className="mx-auto max-w-4xl pb-8 pt-14 sm:pt-20">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-500">Story → angle → point of view → post</div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-6xl sm:leading-[1.05]">Find something worth saying.</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-neutral-500 sm:text-lg">PostCraft helps you find a story with substance, see the strongest angles, and turn your own point of view into a post.</p>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-7">
          <div className="flex items-center justify-between"><div><div className="text-sm font-semibold">Choose your feed</div><div className="mt-1 text-sm text-neutral-500">Start with the kind of story you want to think about.</div></div><div className="text-xs font-medium text-neutral-400">01</div></div>
          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            {feeds.map((feed) => <button key={feed.id} onClick={() => setTopic(feed.id)} className={`rounded-2xl border p-5 text-left transition ${topic === feed.id ? "border-neutral-900 bg-neutral-950 text-white shadow-lg" : "border-neutral-200 bg-neutral-50/50 text-neutral-800 hover:border-neutral-400 hover:bg-white"}`}><div className="flex items-center gap-2 text-sm font-semibold"><span>{feed.icon}</span>{feed.id}</div><div className={`mt-3 text-sm leading-6 ${topic === feed.id ? "text-neutral-300" : "text-neutral-500"}`}>{feed.description}</div></button>)}
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row"><button onClick={() => setTopic("Custom topic")} className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${topic === "Custom topic" ? "border-neutral-900 bg-neutral-950 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}>✏️ Custom topic</button>{topic === "Custom topic" && <input autoFocus value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Company, industry, question or topic" className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm outline-none transition focus:border-neutral-900 focus:bg-white" />}</div>
          <button onClick={discoverIdeas} disabled={loading || (topic === "Custom topic" && !customTopic.trim())} className="mt-4 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">{loading ? "Finding stories…" : "Find stories"}</button>
        </section>

        {ideas.length > 0 && <section className="mt-12">
          <div className="flex items-end justify-between"><div><div className="text-sm font-semibold">Worth exploring</div><p className="mt-1 text-sm text-neutral-500">Choose the story that gives you something to react to.</p></div><div className="text-xs font-medium text-neutral-400">{ideas.length} stories</div></div>
          <div className="mt-4 grid gap-4">{ideas.map((idea) => { const selected = selectedIdea?.url === idea.url; return <article key={idea.url} className={`rounded-2xl border bg-white p-5 transition ${selected ? "border-neutral-900 shadow-[0_8px_30px_rgba(0,0,0,0.06)]" : "border-neutral-200 hover:border-neutral-300"}`}><div className="flex flex-col gap-5 md:flex-row md:justify-between"><div className="min-w-0 max-w-4xl"><div className="text-xs font-medium text-neutral-400">{idea.source}{idea.publishedAt ? ` · ${formatDate(idea.publishedAt)}` : ""}</div><h2 className="mt-2 text-lg font-semibold leading-7 tracking-tight sm:text-xl">{idea.title}</h2>{idea.description && <p className="mt-3 text-sm leading-6 text-neutral-600">{idea.description}</p>}<div className="mt-4 border-l-2 border-neutral-200 pl-3"><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Why it may be worth exploring</div><p className="mt-1 text-sm leading-6 text-neutral-600">{idea.whyItMatters}</p></div><a href={idea.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-medium text-neutral-500 underline underline-offset-4 hover:text-neutral-900">Read source ↗</a></div><button onClick={() => { setSelectedIdea(idea); setPost(""); setCopied(false); generateAngles(idea); }} className={`h-fit shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${selected ? "bg-neutral-950 text-white" : "border border-neutral-200 bg-white text-neutral-800 hover:border-neutral-900"}`}>{selected ? "Selected" : "Choose story"}</button></div></article>; })}</div>
        </section>}

        {selectedIdea && <section className="mt-12 rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-7">
          <div className="flex items-center justify-between"><div><div className="text-sm font-semibold">Choose your angle</div><p className="mt-1 text-sm text-neutral-500">Three grounded ways into the same story. Pick the one you would actually say.</p></div><div className="text-xs font-medium text-neutral-400">02</div></div>
          {angleLoading ? <div className="mt-5 rounded-2xl bg-neutral-50 p-5 text-sm text-neutral-500">Reading the source and finding grounded angles…</div> : <div className="mt-5 grid gap-3 lg:grid-cols-3">{suggestedAngles.map((item, index) => <button key={item.text} onClick={() => setAngle(item.text)} className={`rounded-2xl border p-5 text-left transition ${angle === item.text ? "border-neutral-900 bg-neutral-950 text-white shadow-lg" : "border-neutral-200 bg-neutral-50/40 text-neutral-800 hover:border-neutral-400 hover:bg-white"}`}><div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">Angle {index + 1}</div><div className="mt-2 text-sm font-semibold leading-6">{item.text}</div>{item.why && <div className={`mt-3 text-xs leading-5 ${angle === item.text ? "text-neutral-300" : "text-neutral-500"}`}>{item.why}</div>}{item.evidence && <div className={`mt-4 border-t pt-3 text-xs leading-5 ${angle === item.text ? "border-neutral-700 text-neutral-300" : "border-neutral-200 text-neutral-500"}`}><span className="font-semibold">Evidence</span><div className="mt-1">{item.evidence}</div></div>}</button>)}</div>}
          <div className="mt-6 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between"><div className="text-xs text-neutral-400">The evidence comes from the source. The point of view is yours.</div><button onClick={() => createPost()} disabled={postLoading || angleLoading || !angle} className="rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40">{postLoading ? "Writing…" : "Create LinkedIn post"}</button></div>
        </section>}

        {post && <section className="mt-12 rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-7"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="text-sm font-semibold">Your post</div><p className="mt-1 text-sm text-neutral-500">A first draft built around the selected story and evidence.</p></div><div className="text-xs font-medium text-neutral-400">03</div></div><div className="mt-5 whitespace-pre-wrap rounded-2xl bg-neutral-50 p-6 text-[15px] leading-7 text-neutral-800">{post}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={copyPost} className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white">{copied ? "Copied ✓" : "Copy post"}</button><button onClick={() => createPost("regenerate")} disabled={postLoading} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-40">Regenerate</button><button onClick={() => createPost("sharper")} disabled={postLoading} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-40">Make sharper</button><button onClick={() => createPost("human")} disabled={postLoading} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium text-neutral-700 hover:border-neutral-400 disabled:opacity-40">Make more human</button></div></section>}

        {error && <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <footer className="py-12 text-center text-xs text-neutral-400">PostCraft AI · Find something worth saying.</footer>
      </div>
    </main>
  );
}
