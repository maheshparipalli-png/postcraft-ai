"use client";

import { useRef, useState } from "react";

type Idea = {
  title: string;
  description: string;
  whyItMatters: string;
  sourceIndexes: number[];
  source: string;
  url: string;
  publishedAt: string;
};

type AngleSuggestion = { text: string; why: string };
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
      const prompt = `You are PostCraft AI, an editorial thinking partner.

Analyze this exact news story for someone who wants to write a thoughtful LinkedIn post.

Topic: ${selectedTopic}
Headline: ${idea.title}
Source: ${idea.source}
Summary: ${idea.description || "No reliable summary was supplied; do not invent missing facts."}

Generate SIX genuinely different, specific points of view. We will keep the strongest three.

GROUNDING:
- Use ONLY the supplied headline and summary.
- Do not import facts, examples, companies, industries, or arguments from other stories.
- Do not infer consequences that the supplied story does not support.
- Never turn uncertainty into fact.

QUALITY:
- Each angle must contain a claim, tension, trade-off, implication, or useful question.
- Go beyond summarizing the news.
- Make the angle debatable enough to support an actual opinion.
- Make the six angles meaningfully different.
- Prefer an overlooked implication over an obvious observation.
- Avoid generic phrases such as "AI is changing the world" or "technology is important."

Return ONLY valid JSON in this exact shape:
[{"angle":"short specific point of view","why":"one sentence explaining why this gives the writer something worth exploring"},{"angle":"...","why":"..."},{"angle":"...","why":"..."},{"angle":"...","why":"..."},{"angle":"...","why":"..."},{"angle":"...","why":"..."}]`;
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "angles", prompt }), signal: controller.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Angle generation failed");
      let parsed: unknown;
      try { parsed = JSON.parse(data.text); } catch { const match = data.text.match(/\[[\s\S]*\]/); if (!match) throw new Error("AI returned an invalid angle list"); parsed = JSON.parse(match[0]); }
      const generatedAngles: AngleSuggestion[] = Array.isArray(parsed) ? parsed.map((item): AngleSuggestion | null => {
        if (item && typeof item === "object") { const value = item as { angle?: unknown; why?: unknown }; const text = typeof value.angle === "string" ? value.angle.trim() : ""; const why = typeof value.why === "string" ? value.why.trim() : ""; return text ? { text, why } : null; }
        if (typeof item === "string" && item.trim()) return { text: item.trim(), why: "A specific point of view grounded in this story." };
        return null;
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
      ? "Make the thesis more pointed. Cut safe filler and state the implication clearly. The reader should have a reason to agree or disagree."
      : mode === "human"
        ? "Make it sound like a smart person wrote it for another smart person. Use plain language, varied sentence length, and natural imperfection. Never manufacture a personal story."
        : mode === "regenerate"
          ? "Take a genuinely different route into the same argument. Change the opening and reasoning structure, not just the wording."
          : "Write the strongest natural version of the selected angle.";
    const prompt = `You are PostCraft AI, an editorial thinking partner.

Turn ONE news development and ONE selected angle into a LinkedIn post with a clear point of view.

INPUT
Topic: ${selectedTopic}
Headline: ${selectedIdea.title}
Summary: ${selectedIdea.description || "No reliable summary was supplied."}
Why worth exploring: ${selectedIdea.whyItMatters}
Source: ${selectedIdea.source}
Selected angle: ${angle}
Why this angle works: ${selectedAngle?.why || "It gives the story a specific point of view."}

GROUNDING — NON-NEGOTIABLE
- Use only information supplied above.
- Do not invent statistics, examples, quotes, events, people, companies, outcomes, or personal experiences.
- Treat sensational or uncertain headlines as claims, not established facts.
- Clearly separate what the story says from interpretation.
- Preserve uncertainty: could stays could; may stays may; a warning stays a warning.
- Do not add job losses, wage effects, inequality, social unrest, political consequences, market effects, or other outcomes unless explicitly present.

WRITING
- 120-180 words.
- 4-7 short paragraphs.
- One central argument.
- Start with the insight or tension, not the headline.
- Use plain language and varied sentence rhythm.
- Develop evidence -> observation -> insight -> implication.
- End when the thought is complete.
- No heading, title, labels, emojis, or more than two hashtags.

NEVER use generic patterns such as "raises a crucial question", "highlights the need", "strike a balance", "game changer", "unlock potential", "What do you think?", "Agree?", or "Thoughts?".

${modeInstruction}

Return ONLY valid JSON: {"post":"the finished LinkedIn post"}`;
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

        {selectedIdea && <section className="mt-12 border-t border-neutral-200 pt-10"><div className="text-sm font-medium text-neutral-700">Choose your angle</div><p className="mt-1 text-sm text-neutral-500">PostCraft found a few ways into this story. Pick the one you actually want to argue.</p><div className="mt-3">{angleLoading ? <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-500">Finding useful angles worth exploring...</div> : suggestedAngles.length > 0 ? <div className="grid gap-3 md:grid-cols-3">{suggestedAngles.map((item) => <button key={item.text} onClick={() => setAngle(item.text)} className={`rounded-xl border p-4 text-left transition ${angle === item.text ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"}`}><div className="text-sm font-medium leading-6">{item.text}</div>{item.why && <div className={`mt-3 text-xs leading-5 ${angle === item.text ? "text-neutral-300" : "text-neutral-500"}`}>{item.why}</div>}</button>)}</div> : <div className="text-sm text-neutral-500">Select an idea to generate possible angles.</div>}</div><button onClick={() => createPost()} disabled={postLoading || angleLoading || !angle} className="mt-5 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{postLoading ? "Creating post..." : "Create LinkedIn post"}</button></section>}

        {post && <section className="mt-12 border-t border-neutral-200 pt-10"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-sm font-medium text-neutral-700">Your post</div><p className="mt-1 text-sm text-neutral-500">Built around your selected story and angle.</p></div><button onClick={copyPost} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900">{copied ? "Copied ✓" : "Copy to clipboard"}</button></div><div className="mt-4 whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-[15px] leading-7">{post}</div><div className="mt-4 flex flex-wrap gap-2"><button onClick={() => createPost("regenerate")} disabled={postLoading} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50">{postLoading ? "Working..." : "Regenerate"}</button><button onClick={() => createPost("sharper")} disabled={postLoading} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50">Make sharper</button><button onClick={() => createPost("human")} disabled={postLoading} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50">Make more human</button></div></section>}

        {error && <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      </div>
    </main>
  );
}
