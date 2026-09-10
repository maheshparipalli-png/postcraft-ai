"use client";

import { useRef, useState } from "react";

type Idea = { title: string; description: string; whyItMatters: string; sourceIndexes: number[]; source: string; url: string; publishedAt: string };
type AngleSuggestion = { text: string; why: string; evidence: string };
type PostMode = "default" | "regenerate" | "sharper" | "human";

const topics = ["AI & Technology", "India", "PostCraft Recommended", "Custom topic"];

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
    setLoading(true); setError(""); setIdeas([]); setSelectedIdea(null); setSuggestedAngles([]); setAngle(""); setPost("");
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
    setAngleLoading(true); setAngle(""); setError(""); setSuggestedAngles([]);
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
        const evidence = typeof value.evidence === "string" ? value.evidence.trim() : "";
        return text ? { text, why, evidence } : null;
      }).filter((item): item is AngleSuggestion => Boolean(item?.text)) : [];
      const uniqueAngles = Array.from(new Map(generatedAngles.map((item) => [item.text.toLowerCase(), item])).values()).slice(0, 3);
      if (!uniqueAngles.length) throw new Error("AI could not find a useful angle for this story");
      if (requestId !== angleRequestRef.current) return;
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
          : "Write the strongest natural version of the selected angle.";
    const prompt = `You are PostCraft AI, an editorial thinking partner.\n\nTurn ONE news development and ONE selected angle into a LinkedIn post.\n\nTopic: ${selectedTopic}\nHeadline: ${selectedIdea.title}\nSource: ${selectedIdea.source}\nURL: ${selectedIdea.url}\nSummary: ${selectedIdea.description || "No reliable summary was supplied."}\nSelected angle: ${angle}\nWhy this angle works: ${selectedAngle?.why || "It gives the story a specific point of view."}\n\nThe server will retrieve the source article and rebuild the evidence ledger before writing. The evidence ledger is the complete factual source.\n\n${modeInstruction}\n\nReturn ONLY valid JSON: {"post":"the finished LinkedIn post"}`;
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
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-center justify-between"><div><div className="text-xl font-semibold tracking-tight">POSTCRAFT AI</div><div className="mt-1 text-sm text-neutral-500">Find something worth saying.</div></div><div className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600">Guest Mode</div></header>
        <section className="mt-16"><h1 className="text-4xl font-semibold tracking-tight">Find something worth saying.</h1><p className="mt-3 max-w-2xl text-lg text-neutral-500">Discover timely ideas, choose your point of view, and turn it into a LinkedIn-ready post.</p></section>

        <section className="mt-10">
          <div className="text-sm font-medium text-neutral-700">Choose your feed</div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {topics.slice(0, 3).map((item) => {
              const description = item === "AI & Technology" ? "AI, technology and the developments worth paying attention to." : item === "India" ? "Indian business, policy, technology and social stories worth knowing." : "The stories PostCraft thinks are most worth saying something about.";
              return <button key={item} onClick={() => setTopic(item)} className={`rounded-2xl border p-4 text-left transition ${topic === item ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}><div className="text-sm font-semibold">{item === "AI & Technology" ? "🤖 " : item === "India" ? "🇮🇳 " : "⭐ "}{item}</div><div className={`mt-2 text-xs leading-5 ${topic === item ? "text-neutral-300" : "text-neutral-500"}`}>{description}</div></button>;
            })}
          </div>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center"><button onClick={() => setTopic("Custom topic")} className={`rounded-lg border px-4 py-2 text-sm font-medium ${topic === "Custom topic" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-700 hover:border-neutral-900"}`}>✏️ Custom topic</button>{topic === "Custom topic" && <input value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} placeholder="Enter a topic, company, industry, or question" className="w-full max-w-xl rounded-lg border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900" />}</div>
          <button onClick={discoverIdeas} disabled={loading || (topic === "Custom topic" && !customTopic.trim())} className="mt-5 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? "Finding ideas..." : "Discover ideas"}</button>
        </section>

        {!loading && ideas.length === 0 && !error && <p className="mt-8 text-sm text-neutral-400">Choose a feed and discover a few ideas worth exploring.</p>}

        {ideas.length > 0 && <section className="mt-12"><div className="flex items-end justify-between"><div><div className="text-sm font-medium text-neutral-700">Worth exploring</div><p className="mt-1 text-sm text-neutral-500">{topic === "PostCraft Recommended" ? "PostCraft's best bets for finding something worth saying." : topic === "India" ? "Current Indian developments with room for a meaningful point of view." : topic === "AI & Technology" ? "Current AI and technology developments worth thinking about." : "Recent developments you could have something meaningful to say about."}</p></div><div className="text-sm text-neutral-400">{ideas.length} ideas</div></div><div className="mt-5 space-y-4">{ideas.map((idea) => { const selected = selectedIdea?.url === idea.url; return <article key={idea.url} className={`rounded-2xl border p-5 transition ${selected ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200"}`}><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div className="max-w-3xl"><h2 className="text-lg font-semibold leading-7">{idea.title}</h2><div className="mt-2 text-xs text-neutral-500">{idea.source}{idea.publishedAt ? ` · ${formatDate(idea.publishedAt)}` : ""}</div>{idea.description && <p className="mt-4 text-sm leading-6 text-neutral-700">{idea.description}</p>}<div className="mt-4"><div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Why this may be worth exploring</div><p className="mt-1 text-sm leading-6 text-neutral-600">{idea.whyItMatters}</p></div><a href={idea.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-medium text-neutral-700 underline underline-offset-4">View source</a></div><button onClick={() => { setSelectedIdea(idea); setPost(""); setCopied(false); setError(""); setAngle(""); setSuggestedAngles([]); generateAngles(idea); }} className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${selected ? "bg-neutral-900 text-white" : "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-900"}`}>{selected ? "Selected" : "Select this idea"}</button></div></article>; })}</div></section>}

        {selectedIdea && <section className="mt-12 border-t border-neutral-200 pt-10"><div className="text-sm font-medium text-neutral-700">Choose your angle</div><p className="mt-1 text-sm text-neutral-500">PostCraft found a few ways into this story. Pick the one you actually want to argue.</p><div className="mt-3">{angleLoading ? <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-500">Reading the source and finding evidence-led angles...</div> : suggestedAngles.length > 0 ? <div className="grid gap-3 md:grid-cols-3">{suggestedAngles.map((item) => <button key={item.text} onClick={() => setAngle(item.text)} className={`rounded-xl border p-4 text-left transition ${angle === item.text ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}><div className="text-sm font-medium leading-6">{item.text}</div>{item.why && <div className={`mt-3 text-xs leading-5 ${angle === item.text ? "text-neutral-300" : "text-neutral-500"}`}>{item.why}</div>}{item.evidence && <div className={`mt-4 border-t pt-3 text-xs leading-5 ${angle === item.text ? "border-neutral-700 text-neutral-300" : "border-neutral-100 text-neutral-500"}`}><span className="font-semibold uppercase tracking-wide">Evidence</span><div className="mt-1">{item.evidence}</div></div>}</button>)}</div> : <div className="text-sm text-neutral-500">Select an idea to generate possible angles.</div>}</div><button onClick={() => createPost()} disabled={postLoading || angleLoading || !angle} className="mt-5 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{postLoading ? "Creating post..." : "Create LinkedIn post"}</button></section>}

        {post && <section className="mt-12 border-t border-neutral-200 pt-10"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-medium text-neutral-700">Your post</div><p className="mt-1 text-sm text-neutral-500">Built around your selected story, thesis and evidence.</p></div><button onClick={copyPost} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900">{copied ? "Copied ✓" : "Copy to clipboard"}</button></div><div className="mt-4 whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-[15px] leading-7">{post}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => createPost("regenerate")} disabled={postLoading} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50">{postLoading ? "Working..." : "Regenerate"}</button><button onClick={() => createPost("sharper")} disabled={postLoading} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50">Make sharper</button><button onClick={() => createPost("human")} disabled={postLoading} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50">Make more human</button></div></section>}

        {error && <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
    </main>
  );
}
