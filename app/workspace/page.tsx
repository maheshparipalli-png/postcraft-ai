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
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "PostCraft Recommended" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Discovery failed");
      setIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }

  async function selectIdea(value: Idea) {
    setIdea(value);
    setAngles([]);
    setEvidence([]);
    setAngle("");
    setPost("");
    setError("");
    setAngleLoading(true);
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
      setAngles(nextAngles);
      setAngle(nextAngles[0].text);
      setEvidence(Array.isArray(data?.evidence) ? data.evidence : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Angle generation failed");
    } finally {
      setAngleLoading(false);
    }
  }

  async function createPost() {
    if (!idea || !angle) return;
    setPostLoading(true);
    setError("");
    const selectedPerspective = perspectives.find((item) => item.id === perspective);
    const prompt = `You are PostCraft AI. Turn ONE news development and ONE selected angle into a LinkedIn post. The user's perspective is editorial guidance, not evidence.\n\nTopic: PostCraft Recommended\nHeadline: ${idea.title}\nSource: ${idea.source}\nURL: ${idea.url}\nSummary: ${idea.description || "No reliable summary was supplied."}\nSelected angle: ${angle}\nWhy this angle works: ${angles.find((item) => item.text === angle)?.why || ""}\nPerspective: ${selectedPerspective?.label}\nPerspective guidance: ${selectedPerspective?.description}\nUser's own note: ${perspectiveNote || "No additional note supplied."}\nEvidence JSON: ${JSON.stringify(evidence)}\n\nRules: Ground factual claims only in the supplied evidence. Do not invent personal experience, examples, statistics, motives, or outside context. Keep the selected angle intact. Make the thesis clear early. Use plain language and natural sentence rhythm. Avoid generic phrases such as "raises important questions", "future of work", "need to strike a balance", or "in today's rapidly changing world". Do not add a generic policy conclusion. Return the post as plain text only.`;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "post", prompt }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Post generation failed");
      let value = typeof data?.text === "string" ? data.text : "";
      try {
        const parsed = JSON.parse(value);
        value = typeof parsed?.post === "string" ? parsed.post : value;
      } catch {
        value = value.replace(/^```(?:json|text|markdown)?\s*/i, "").replace(/\s*```$/i, "").trim();
      }
      if (!value.trim()) throw new Error("AI returned an empty post");
      setPost(value.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Post generation failed");
    } finally {
      setPostLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-center justify-between">
          <div><div className="text-xl font-semibold tracking-tight">POSTCRAFT AI</div><div className="mt-1 text-sm text-neutral-500">Editorial workspace</div></div>
          <Link href="/" className="text-sm text-neutral-500 underline underline-offset-4">Back to Discover</Link>
        </header>

        <section className="mt-14">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Next stage</div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Bring your point of view into the post.</h1>
          <p className="mt-3 max-w-2xl text-lg leading-7 text-neutral-500">The story and evidence come from PostCraft. The opinion should come from you.</p>
          <button onClick={discover} disabled={loading} className="mt-6 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{loading ? "Finding stories..." : "Find a story to work on"}</button>
        </section>

        {ideas.length > 0 && <section className="mt-10"><div className="text-sm font-medium text-neutral-700">Choose a story</div><div className="mt-4 space-y-3">{ideas.map((item) => <button key={item.url} onClick={() => selectIdea(item)} className={`w-full rounded-2xl border p-5 text-left transition ${idea?.url === item.url ? "border-neutral-900 ring-1 ring-neutral-900" : "border-neutral-200 hover:border-neutral-400"}`}><div className="text-lg font-semibold leading-7">{item.title}</div><div className="mt-2 text-xs text-neutral-500">{item.source}{item.publishedAt ? ` · ${formatDate(item.publishedAt)}` : ""}</div>{item.description && <div className="mt-3 text-sm leading-6 text-neutral-600">{item.description}</div>}<div className="mt-3 text-sm text-neutral-500">{item.whyItMatters}</div></button>)}</div></section>}

        {idea && <section className="mt-12 border-t border-neutral-200 pt-10">
          <div className="text-sm font-medium text-neutral-700">1. Choose your angle</div>
          <p className="mt-1 text-sm text-neutral-500">PostCraft gives you three grounded ways into the story. Pick the one worth saying something about.</p>
          {angleLoading ? <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-500">Reading the source and finding grounded angles...</div> : <div className="mt-4 grid gap-3 md:grid-cols-3">{angles.map((item) => <button key={item.text} onClick={() => { setAngle(item.text); setPost(""); }} className={`rounded-xl border p-4 text-left ${angle === item.text ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:border-neutral-400"}`}><div className="text-sm font-medium leading-6">{item.text}</div><div className={`mt-3 text-xs leading-5 ${angle === item.text ? "text-neutral-300" : "text-neutral-500"}`}>{item.why}</div>{item.evidence && <div className={`mt-4 border-t pt-3 text-xs ${angle === item.text ? "border-neutral-700 text-neutral-300" : "border-neutral-100 text-neutral-500"}`}><span className="font-semibold uppercase tracking-wide">Evidence</span><div className="mt-1">{item.evidence}</div></div>}</button>)}</div>}

          <div className={`mt-10 transition ${angle ? "opacity-100" : "opacity-50"}`}><div className="text-sm font-medium text-neutral-700">2. What’s your take?</div><p className="mt-1 text-sm text-neutral-500">Now react to the angle. PostCraft should never invent this part for you.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{perspectives.map((item) => <button key={item.id} onClick={() => setPerspective(item.id)} disabled={!angle} className={`rounded-xl border p-4 text-left ${perspective === item.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 hover:border-neutral-400"} disabled:cursor-not-allowed disabled:hover:border-neutral-200`}><div className="text-sm font-medium">{item.label}</div><div className={`mt-1 text-xs ${perspective === item.id ? "text-neutral-300" : "text-neutral-500"}`}>{item.description}</div></button>)}</div><textarea value={perspectiveNote} onChange={(event) => setPerspectiveNote(event.target.value)} disabled={!angle} placeholder="Optional: add the thought you want PostCraft to preserve..." rows={4} className="mt-4 w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm leading-6 outline-none focus:border-neutral-900 disabled:cursor-not-allowed disabled:bg-neutral-50" /></div>

          <div className={`mt-10 transition ${angle ? "opacity-100" : "opacity-50"}`}><div className="text-sm font-medium text-neutral-700">3. Create the post</div><p className="mt-1 text-sm text-neutral-500">PostCraft combines the evidence, your selected angle, and your point of view.</p><button onClick={createPost} disabled={postLoading || angleLoading || !angle} className="mt-4 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{postLoading ? "Writing..." : "Create LinkedIn post"}</button></div>
        </section>}

        {post && <section className="mt-12 border-t border-neutral-200 pt-10"><div className="text-sm font-medium text-neutral-700">Your post</div><div className="mt-4 whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-[15px] leading-7">{post}</div><div className="mt-4 flex gap-3"><button onClick={() => navigator.clipboard.writeText(post)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:border-neutral-900">Copy</button><button onClick={createPost} disabled={postLoading} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium hover:border-neutral-900 disabled:opacity-50">Regenerate from my take</button></div></section>}
        {error && <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
    </main>
  );
}
