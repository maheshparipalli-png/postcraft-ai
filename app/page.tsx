"use client";

import { useRef, useState } from "react";

type Idea = { title: string; description: string; whyItMatters: string; sourceIndexes: number[]; source: string; url: string; publishedAt: string };
type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type AngleSuggestion = { text: string; why: string; evidence: string };
type Perspective = "agree" | "disagree" | "mixed" | "curious";

const topics = ["AI & Technology", "India", "PostCraft Recommended", "Custom topic"];
const perspectives: { id: Perspective; label: string; description: string }[] = [
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

function cleanGeneratedPost(value: string) {
  return value.replace(/^```(?:text|markdown|json)?\s*/i, "").replace(/\s*```$/i, "").replace(/^\s*(LinkedIn post|Post):\s*/i, "").trim();
}

export default function Home() {
  const [topic, setTopic] = useState("PostCraft Recommended");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [angle, setAngle] = useState("");
  const [suggestedAngles, setSuggestedAngles] = useState<AngleSuggestion[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [perspective, setPerspective] = useState<Perspective>("mixed");
  const [perspectiveNote, setPerspectiveNote] = useState("");
  const [post, setPost] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [angleLoading, setAngleLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const angleRequestRef = useRef(0);
  const angleAbortRef = useRef<AbortController | null>(null);

  function resetFromStory() {
    setAngle(""); setSuggestedAngles([]); setEvidence([]); setPerspective("mixed"); setPerspectiveNote(""); setPost(""); setCopied(false);
  }

  async function discoverIdeas() {
    setLoading(true); setError(""); setIdeas([]); setSelectedIdea(null); resetFromStory();
    try {
      const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: selectedTopic }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Discovery failed");
      setIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
    } catch (err) { setError(err instanceof Error ? err.message : "Discovery failed"); }
    finally { setLoading(false); }
  }

  async function selectIdea(idea: Idea) {
    const requestId = ++angleRequestRef.current;
    angleAbortRef.current?.abort();
    const controller = new AbortController(); angleAbortRef.current = controller;
    setSelectedIdea(idea); resetFromStory(); setError(""); setAngleLoading(true);
    try {
      const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
      const prompt = `You are PostCraft AI, an editorial thinking partner.\n\nAnalyze this exact news story and the source article itself. Find thoughtful, evidence-led LinkedIn angles.\n\nTopic: ${selectedTopic}\nHeadline: ${idea.title}\nSource: ${idea.source}\nURL: ${idea.url}\nSummary: ${idea.description || "No reliable summary was supplied."}\n\nThe server will retrieve the source article and build an evidence ledger before generating angles. Do not rely on outside knowledge.\n\nReturn ONLY valid JSON. The system will return the strongest three grounded angles.`;
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "angles", prompt }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Angle generation failed");
      let parsed: unknown;
      try { parsed = JSON.parse(data.text); } catch { const match = String(data.text).match(/\[[\s\S]*\]/); if (!match) throw new Error("AI returned an invalid angle list"); parsed = JSON.parse(match[0]); }
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
      setEvidence(Array.isArray(data?.evidence) ? data.evidence : []); setSuggestedAngles(uniqueAngles); setAngle(uniqueAngles[0].text);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (requestId === angleRequestRef.current) setError(err instanceof Error ? err.message : "Angle generation failed");
    } finally { if (requestId === angleRequestRef.current) setAngleLoading(false); }
  }

  async function createPost() {
    if (!selectedIdea || !angle) return;
    setPostLoading(true); setError(""); setCopied(false);
    const selectedAngle = suggestedAngles.find((item) => item.text === angle);
    const selectedPerspective = perspectives.find((item) => item.id === perspective);
    const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
    const prompt = `You are PostCraft AI, an editorial thinking partner.\n\nTurn ONE news development, ONE selected angle, and the user's point of view into a LinkedIn post.\n\nTopic: ${selectedTopic}\nHeadline: ${selectedIdea.title}\nSource: ${selectedIdea.source}\nURL: ${selectedIdea.url}\nSummary: ${selectedIdea.description || "No reliable summary was supplied."}\nSelected angle: ${angle}\nWhy this angle works: ${selectedAngle?.why || "It gives the story a specific point of view."}\nUser perspective: ${selectedPerspective?.label}\nPerspective guidance: ${selectedPerspective?.description}\nUser's own note: ${perspectiveNote || "No additional note supplied."}\nEvidence JSON: ${JSON.stringify(evidence)}\n\nThe evidence JSON above was extracted from the source article during angle generation. Use it as the complete factual source. Do not invent additional context, personal experience, statistics, motives, or examples. Keep the selected angle intact. Make the thesis clear early. Use plain language and natural sentence rhythm. Avoid generic phrases such as "raises important questions", "future of work", "need to strike a balance", or "in today's rapidly changing world". Do not add a generic policy conclusion.\n\nReturn ONLY valid JSON: {"post":"the finished LinkedIn post"}`;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Post generation failed");
      const generatedPost = cleanGeneratedPost(typeof data?.text === "string" ? data.text : "");
      if (!generatedPost) throw new Error("AI returned an empty post");
      let value = generatedPost;
      try { const parsed = JSON.parse(generatedPost); if (typeof parsed?.post === "string") value = parsed.post.trim(); } catch { /* plain text */ }
      setPost(value);
    } catch (err) { setError(err instanceof Error ? err.message : "Post generation failed"); }
    finally { setPostLoading(false); }
  }

  async function copyPost() {
    if (!post) return;
    try { await navigator.clipboard.writeText(post); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError("Could not copy the post to your clipboard"); }
  }

  return (
    <main className="min-h-screen bg-[#fafaf9] text-neutral-950">
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8 sm:py-10">
        <header className="flex items-center justify-between border-b border-neutral-200 pb-6"><div><div className="text-xl font-semibold tracking-tight">POSTCRAFT AI</div><div className="mt-1 text-sm text-neutral-500">Find something worth saying.</div></div><div className="rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-500">Guest Mode</div></header>
        <section className="py-12 sm:py-16"><div className="max-w-3xl"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">A simple editorial workflow</div><h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Find something worth saying.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-neutral-500 sm:text-lg">Start with a story. Choose the angle. Add your point of view. PostCraft does the research and writing without pretending to be you.</p></div><div className="mt-9 grid grid-cols-4 gap-2 sm:max-w-2xl">{["Story", "Angle", "Your take", "Post"].map((label, index) => { const active = index === 0 || (index === 1 && selectedIdea) || (index === 2 && angle) || (index === 3 && post); return <div key={label} className="flex items-center gap-2 text-xs text-neutral-400"><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white"}`}>{index + 1}</span><span className={active ? "font-medium text-neutral-700" : ""}>{label}</span></div>; })}</div></section>
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_rgba(0,0,0,0.04)] sm:p-7"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Step 1 · Find a story</div><h2 className="mt-2 text-2xl font-semibold tracking-tight">What is worth exploring?</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">Choose a feed and PostCraft will bring back stories with enough substance to build a point of view around.</p><div className="mt-5 grid gap-3 md:grid-cols-3">{topics.slice(0, 3).map((item) => { const description = item === "AI & Technology" ? "AI, technology and the developments worth paying attention to." : item === "India" ? "Indian business, policy, technology and social stories worth knowing." : "The stories PostCraft thinks are most worth saying something about."; const selected = topic === item; return <button key={item} onClick={() => setTopic(item)} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:border-neutral-400"}`}><div className="text-sm font-semibold">{item === "AI & Technology" ? "🤖 " : item === "India" ? "🇮🇳 " : "⭐ "}{item}</div><div className={`mt-2 text-xs leading-5 ${selected ? "text-neutral-300" : "text-neutral-500"}`}>{description}</div></button>; })}</div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><button onClick={() => setTopic("Custom topic")} className={`rounded-xl border px-4 py-2.5 text-sm font-medium ${topic === "Custom topic" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-900"}`}>✏️ Custom topic</button>{topic === "Custom topic" && <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Topic, company, industry, or question" className="w-full max-w-xl rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-neutral-900" />}</div><button onClick={discoverIdeas} disabled={loading || (topic === "Custom topic" && !customTopic.trim())} className="mt-5 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Finding stories..." : "Find stories"}</button></section>
        {ideas.length > 0 && <section className="mt-8"><div className="flex items-end justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Step 1 · Choose</div><h2 className="mt-2 text-2xl font-semibold tracking-tight">Worth exploring</h2><p className="mt-1 text-sm text-neutral-500">Select one story. Everything below will be built around it.</p></div><div className="text-xs text-neutral-400">{ideas.length} stories</div></div><div className="mt-5 space-y-3">{ideas.map((idea) => { const selected = selectedIdea?.url === idea.url; return <article key={idea.url} className={`rounded-2xl border bg-white p-5 transition ${selected ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-300"}`}><div className="flex flex-col gap-4 md:flex-row md:justify-between"><div className="max-w-3xl"><h3 className="text-lg font-semibold leading-7">{idea.title}</h3><div className="mt-2 text-xs text-neutral-500">{idea.source}{idea.publishedAt ? ` · ${formatDate(idea.publishedAt)}` : ""}</div>{idea.description && <p className="mt-3 text-sm leading-6 text-neutral-700">{idea.description}</p>}<div className="mt-3"><div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Why it may be worth saying something about</div><p className="mt-1 text-sm leading-6 text-neutral-600">{idea.whyItMatters}</p></div><a href={idea.url} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-neutral-600 underline underline-offset-4">Read source</a></div><button onClick={() => selectIdea(idea)} className={`shrink-0 self-start rounded-xl px-4 py-2.5 text-sm font-medium ${selected ? "bg-neutral-900 text-white" : "border border-neutral-300 hover:border-neutral-900"}`}>{selected ? "Selected ✓" : "Choose story"}</button></div></article>; })}</div></section>}
        {selectedIdea && <section className="mt-10 border-t border-neutral-200 pt-10"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Step 2 · Choose an angle</div><h2 className="mt-2 text-2xl font-semibold tracking-tight">What is actually interesting here?</h2><p className="mt-2 text-sm leading-6 text-neutral-500">PostCraft gives you a few evidence-led ways into the story. Pick the argument you would be comfortable owning.</p>{angleLoading ? <div className="mt-5 rounded-2xl border border-neutral-200 bg-white p-5 text-sm text-neutral-500">Reading the source and finding grounded angles...</div> : <div className="mt-5 grid gap-3 md:grid-cols-3">{suggestedAngles.map((item) => { const selected = angle === item.text; return <button key={item.text} onClick={() => { setAngle(item.text); setPost(""); }} className={`rounded-2xl border p-5 text-left transition ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-400"}`}><div className="text-sm font-medium leading-6">{item.text}</div>{item.why && <div className={`mt-3 text-xs leading-5 ${selected ? "text-neutral-300" : "text-neutral-500"}`}>{item.why}</div>}{item.evidence && <div className={`mt-4 border-t pt-3 text-xs leading-5 ${selected ? "border-neutral-700 text-neutral-300" : "border-neutral-100 text-neutral-500"}`}><span className="font-semibold uppercase tracking-wide">Evidence</span><div className="mt-1">{item.evidence}</div></div>}</button>; })}</div>}</section>}
        {angle && <section className="mt-10 border-t border-neutral-200 pt-10"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Step 3 · Your take</div><h2 className="mt-2 text-2xl font-semibold tracking-tight">What do you think?</h2><p className="mt-2 text-sm leading-6 text-neutral-500">This is the part PostCraft should not invent. Give it your direction; it will build the argument around it.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{perspectives.map((item) => { const selected = perspective === item.id; return <button key={item.id} onClick={() => setPerspective(item.id)} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white hover:border-neutral-400"}`}><div className="text-sm font-medium">{item.label}</div><div className={`mt-1 text-xs leading-5 ${selected ? "text-neutral-300" : "text-neutral-500"}`}>{item.description}</div></button>; })}</div><textarea value={perspectiveNote} onChange={(event) => setPerspectiveNote(event.target.value)} placeholder="Optional: add the thought, distinction, experience, or question you want PostCraft to preserve..." rows={4} className="mt-4 w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm leading-6 outline-none focus:border-neutral-900" /><button onClick={createPost} disabled={postLoading} className="mt-4 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-50">{postLoading ? "Writing your post..." : "Create LinkedIn post"}</button></section>}
        {post && <section className="mt-10 border-t border-neutral-200 pt-10"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-semibold uppercase tracking-[0.16em] text-neutral-400">Step 4 · Your post</div><h2 className="mt-2 text-2xl font-semibold tracking-tight">Review before you post.</h2><p className="mt-1 text-sm text-neutral-500">PostCraft gives you the draft. You remain the author.</p></div><button onClick={copyPost} className="rounded-xl border border-neutral-300 bg-white px-4 py-2.5 text-sm font-medium hover:border-neutral-900">{copied ? "Copied ✓" : "Copy post"}</button></div><textarea value={post} onChange={(event) => setPost(event.target.value)} rows={12} className="mt-5 w-full resize-y rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-[15px] leading-7 outline-none focus:border-neutral-900" /><div className="mt-3 text-xs text-neutral-400">Edit anything you want. The final call is yours.</div></section>}
        {error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">{error}</div>}
      </div>
    </main>
  );
}
