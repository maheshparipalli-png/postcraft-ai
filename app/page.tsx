"use client";
import { createClient } from "@/lib/supabase/client";

import { useRef, useState } from "react";
import SignOutButton from "./SignOutButton";

type Idea = { title: string; description: string; whyItMatters: string; sourceIndexes: number[]; source: string; url: string; publishedAt: string };
type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type AngleSuggestion = { text: string; why: string; evidence: string };
type Perspective = "agree" | "disagree" | "mixed" | "curious";

const topics = ["AI & Technology", "India", "Custom topic"];
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
  const [topic, setTopic] = useState("AI & Technology");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [angle, setAngle] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
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
    setAngle("");
    setSuggestedAngles([]);
    setEvidence([]);
    setPerspective("mixed");
    setPerspectiveNote("");
    setPost("");
    setCopied(false);
  }

  async function discoverIdeas() {
    setLoading(true);
    setError("");
    setIdeas([]);
    setSelectedIdea(null);
    resetFromStory();
    try {
      const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selectedTopic }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Discovery failed");
      setIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }

  async function selectIdea(idea: Idea) {
    const requestId = ++angleRequestRef.current;
    angleAbortRef.current?.abort();
    const controller = new AbortController();
    angleAbortRef.current = controller;
    setSelectedIdea(idea);
    resetFromStory();
    setError("");
    setAngleLoading(true);
    try {
      const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
      const prompt = `You are PostCraft AI, an editorial thinking partner. Analyze only this exact news story information and find thoughtful, evidence-led LinkedIn angles. Do not search the internet and do not rely on outside knowledge.\n\nTopic: ${selectedTopic}\nHeadline: ${idea.title}\nSource: ${idea.source}\nURL: ${idea.url}\nSummary: ${idea.description || "No reliable summary was supplied."}\n\nReturn ONLY valid JSON. The system will return the strongest three grounded angles.`;
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "angles", prompt }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Angle generation failed");
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.text);
      } catch {
        const match = String(data.text).match(/\[[\s\S]*\]/);
        if (!match) throw new Error("PostCraft could not finish thinking about this story. Try another story.");
        parsed = JSON.parse(match[0]);
      }
      const generatedAngles: AngleSuggestion[] = Array.isArray(parsed)
        ? parsed.map((item): AngleSuggestion | null => {
            if (!item || typeof item !== "object") return null;
            const value = item as { angle?: unknown; why?: unknown; evidence?: unknown };
            const text = typeof value.angle === "string" ? value.angle.trim() : "";
            const why = typeof value.why === "string" ? value.why.trim() : "";
            const evidenceAnchor = typeof value.evidence === "string" ? value.evidence.trim() : "";
            return text ? { text, why, evidence: evidenceAnchor } : null;
          }).filter((item): item is AngleSuggestion => Boolean(item?.text))
        : [];
      const uniqueAngles = Array.from(new Map(generatedAngles.map((item) => [item.text.toLowerCase(), item])).values()).slice(0, 3);
      if (!uniqueAngles.length) throw new Error("PostCraft could not find a useful angle for this story. Try another story.");
      if (requestId !== angleRequestRef.current) return;
      setEvidence(Array.isArray(data?.evidence) ? data.evidence : []);
      setSuggestedAngles(uniqueAngles);
      setAngle(uniqueAngles[0].text);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (requestId === angleRequestRef.current) setError(err instanceof Error ? err.message : "PostCraft could not finish thinking about this story. Try another story.");
    } finally {
      if (requestId === angleRequestRef.current) setAngleLoading(false);
    }
  }

  async function createPost() {
    if (!selectedIdea || !angle) return;
    setPostLoading(true);
    setError("");
    setCopied(false);
    const selectedAngle = suggestedAngles.find((item) => item.text === angle);
    const selectedPerspective = perspectives.find((item) => item.id === perspective);
    const selectedTopic = topic === "Custom topic" ? customTopic.trim() : topic;
    const prompt = `You are PostCraft AI, an editorial thinking partner. Turn ONE news development, ONE selected angle, and the user's point of view into a LinkedIn post.\n\nTopic: ${selectedTopic}\nHeadline: ${selectedIdea.title}\nSource: ${selectedIdea.source}\nURL: ${selectedIdea.url}\nSummary: ${selectedIdea.description || "No reliable summary was supplied."}\nSelected angle: ${angle}\nWhy this angle works: ${selectedAngle?.why || "It gives the story a specific point of view."}\nUser perspective: ${selectedPerspective?.label}\nPerspective guidance: ${selectedPerspective?.description}\nUser's own note: ${perspectiveNote || "No additional note supplied."}\nEvidence JSON: ${JSON.stringify(evidence)}\n\nThe evidence JSON above is the complete factual source. Do not search the internet. Do not add outside facts, personal experience, statistics, motives, or examples. Keep the selected angle intact. Make the thesis clear early. Use plain language and natural sentence rhythm. Avoid generic phrases such as "raises important questions", "future of work", "need to strike a balance", or "in today's rapidly changing world". Do not add a generic policy conclusion. Return ONLY the finished LinkedIn post.`;
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post", prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Post generation failed");
      const generatedPost = cleanGeneratedPost(typeof data?.text === "string" ? data.text : "");
      if (!generatedPost) throw new Error("PostCraft could not create the post. Please try again.");
      let value = generatedPost;
      try {
        const parsed = JSON.parse(generatedPost);
        if (typeof parsed?.post === "string") value = parsed.post.trim();
      } catch {
        // Plain-text response is expected.
      }
      setPost(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PostCraft could not create the post. Please try again.");
    } finally {
      setPostLoading(false);
    }
  }

  async function copyPost() {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the post to your clipboard.");
    }
  }

  const stage = post ? 4 : angle ? 3 : selectedIdea ? 2 : ideas.length ? 1 : 0;
  const stageLabels = ["Find", "Think", "Take", "Write"];

  async function savePost() {
    if (!post.trim()) {
      setSaveMessage("There is no post to save yet.");
      return;
    }

    setSaveLoading(true);
    setSaveMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Please sign in before saving a post.");
      }

      const { error } = await supabase.from("posts").insert({
        user_id: user.id,
        title: selectedIdea?.title ?? null,
        content: post.trim(),
        topic: topic || null,
        source_url: selectedIdea?.url ?? null,
        angle: angle || null,
        tone: perspective || null,
        status: "draft",
      });

      if (error) {
        throw error;
      }

      setSaveMessage("Post saved.");
    } catch (error) {
      const saveError = error as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      console.error(
        "Save post error:",
        JSON.stringify({
          message: String(saveError?.message ?? ""),
          details: String(saveError?.details ?? ""),
          hint: String(saveError?.hint ?? ""),
          code: String(saveError?.code ?? ""),
          raw: error instanceof Error ? error.message : error,
        })
      );

      const diagnosticMessage = [
        saveError?.message,
        saveError?.details,
        saveError?.hint,
        saveError?.code ? `Code: ${saveError.code}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      setSaveMessage(
        diagnosticMessage ||
          (error instanceof Error
            ? error.message
            : "Could not save the post. Please try again.")
      );
    } finally {
      setSaveLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717] selection:bg-neutral-900 selection:text-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7">
          <div>
            <div className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCRAFT</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">AI editorial studio</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="text-xs text-neutral-500">Find something worth saying.</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">{stageLabels[Math.min(stage, 3)]}</div>
            </div>
            <SignOutButton />
          </div>
        </header>

        <nav className="flex items-center justify-between border-b border-neutral-200/80 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-400" aria-label="Editorial progress">
          {stageLabels.map((label, index) => {
            const current = index + 1 === Math.max(stage, 1);
            const complete = index + 1 < stage;
            return <div key={label} className={`flex items-center gap-2 ${current ? "text-neutral-900" : complete ? "text-neutral-600" : ""}`}><span className={`h-1.5 w-1.5 rounded-full ${current ? "bg-neutral-900" : complete ? "bg-neutral-500" : "bg-neutral-300"}`} />{label}</div>;
          })}
        </nav>

        <section className="py-14 sm:py-20">
          <div className="max-w-4xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">01 / Find</div>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] sm:text-7xl">Find something<br className="hidden sm:block" /> worth saying.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">Start with a story. PostCraft helps you find the interesting question inside it â€” before you write a word.</p>
          </div>
        </section>

        <section className="border-t border-neutral-300/80 py-10 sm:py-12">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">Choose a feed</div>
              <div className="mt-2 text-sm leading-6 text-neutral-500">What should we look at?</div>
            </div>
            <div>
              <div className="grid border-y border-neutral-300/80 sm:grid-cols-2">
                {topics.slice(0, 2).map((item) => {
                  const selected = topic === item;
                  const description = item === "AI & Technology" ? "AI, technology and the developments worth paying attention to." : "Indian business, policy, technology and social stories worth knowing.";
                  return <button key={item} onClick={() => setTopic(item)} className={`group border-b border-neutral-300/80 p-5 text-left transition sm:p-6 ${item === "AI & Technology" ? "sm:border-r" : "sm:border-b-0"} ${selected ? "bg-white" : "hover:bg-white/60"}`}>
                    <div className="flex items-center justify-between"><span className="font-serif text-xl">{item}</span><span className={`text-xs transition ${selected ? "translate-x-0 opacity-100" : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-60"}`}>Selected</span></div>
                    <p className="mt-3 max-w-sm text-xs leading-5 text-neutral-500">{description}</p>
                  </button>;
                })}
              </div>
              <div className={`border-b border-neutral-300/80 ${topic === "Custom topic" ? "bg-white" : ""}`}>
                <button onClick={() => setTopic("Custom topic")} className="flex w-full items-center justify-between p-5 text-left sm:p-6">
                  <span className="font-serif text-xl">Custom topic</span><span className="text-sm text-neutral-400">Write your own →</span>
                </button>
                {topic === "Custom topic" && <div className="px-5 pb-6 sm:px-6"><input autoFocus value={customTopic} onChange={(event) => setCustomTopic(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && customTopic.trim()) discoverIdeas(); }} placeholder="Topic, company, industry, or question" className="w-full border-b border-neutral-400 bg-transparent px-0 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-900" /></div>}
              </div>
              <button onClick={discoverIdeas} disabled={loading || (topic === "Custom topic" && !customTopic.trim())} className="mt-7 border-b border-neutral-900 pb-1 text-sm font-medium transition hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400">{loading ? "Finding stories..." : "Find stories →"}</button>
            </div>
          </div>
        </section>

        {ideas.length > 0 && <section className="border-t border-neutral-300/80 py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">02 / Choose</div>
              <h2 className="mt-2 font-serif text-2xl">A story worth exploring.</h2>
              <div className="mt-3 text-xs text-neutral-500">{ideas.length} stories found</div>
            </div>
            <div className="divide-y divide-neutral-300/80 border-y border-neutral-300/80">
              {ideas.map((idea, index) => {
                const selected = selectedIdea?.url === idea.url;
                return <article key={idea.url} className={`group py-7 sm:py-8 ${selected ? "bg-white px-5 sm:px-7" : ""}`}>
                  <div className="flex gap-5">
                    <div className="hidden pt-1 font-serif text-sm text-neutral-400 sm:block">0{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">{idea.source}{idea.publishedAt ? ` Â· ${formatDate(idea.publishedAt)}` : ""}</div>
                      <h3 className="mt-2 max-w-3xl font-serif text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">{idea.title}</h3>
                      {idea.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{idea.description}</p>}
                      {idea.whyItMatters && <div className="mt-5 max-w-2xl border-l border-neutral-400 pl-4"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Why this is interesting</div><p className="mt-1.5 text-sm leading-6 text-neutral-800">{idea.whyItMatters}</p></div>}
                      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
                        <a href={idea.url} target="_blank" rel="noreferrer" className="text-neutral-500 underline underline-offset-4 hover:text-neutral-900">Read source</a>
                        <button onClick={() => selectIdea(idea)} className="font-medium text-neutral-900 hover:underline hover:underline-offset-4">{selected ? "Chosen" : "Explore this story →"}</button>
                      </div>
                    </div>
                  </div>
                </article>;
              })}
            </div>
          </div>
        </section>}

        {selectedIdea && <section className="border-t border-neutral-300/80 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">03 / Think</div>
              <h2 className="mt-2 font-serif text-2xl">What's actually interesting here?</h2>
            </div>
            <div>
              <div className="max-w-2xl border-b border-neutral-300/80 pb-7">
                <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Selected story</div>
                <div className="mt-2 font-serif text-xl leading-7">{selectedIdea.title}</div>
              </div>
              {angleLoading ? <div className="py-10 text-sm text-neutral-500"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-900" /> <span className="ml-2">Thinking through the story...</span></div> : <div className="divide-y divide-neutral-300/80 border-b border-neutral-300/80">{suggestedAngles.map((item, index) => {
                const selected = angle === item.text;
                return <button key={item.text} onClick={() => { setAngle(item.text); setPost(""); }} className={`group block w-full py-7 text-left transition ${selected ? "bg-white px-5 sm:px-7" : "hover:bg-white/60"}`}>
                  <div className="flex gap-5">
                    <div className="pt-1 font-serif text-sm text-neutral-400">0{index + 1}</div>
                    <div className="max-w-3xl"><div className="font-serif text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">{item.text}</div>{item.why && <div className="mt-3 text-sm leading-6 text-neutral-600">{item.why}</div>}{item.evidence && <div className="mt-3 text-xs leading-5 text-neutral-500"><span className="font-semibold text-neutral-700">Evidence:</span> {item.evidence}</div>}<div className={`mt-4 text-xs font-medium ${selected ? "text-neutral-900" : "text-neutral-500 group-hover:text-neutral-900"}`}>{selected ? "Selected angle" : "Choose this angle →"}</div></div>
                  </div>
                </button>;
              })}</div>}
            </div>
          </div>
        </section>}

        {angle && <section className="border-t border-neutral-300/80 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">04 / Take</div>
              <h2 className="mt-2 font-serif text-2xl">Now make it yours.</h2>
              <p className="mt-3 text-xs leading-5 text-neutral-500">PostCraft can shape your words. It should not invent your opinion.</p>
            </div>
            <div>
              <div className="max-w-3xl border-b border-neutral-300/80 pb-7">
                <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Your chosen angle</div>
                <div className="mt-2 font-serif text-2xl leading-8">{angle}</div>
              </div>
              <div className="grid border-b border-neutral-300/80 sm:grid-cols-2">
                {perspectives.map((item) => <button key={item.id} onClick={() => setPerspective(item.id)} className={`border-b border-neutral-300/80 p-5 text-left transition sm:p-6 ${perspective === item.id ? "bg-neutral-900 text-white" : "hover:bg-white/70"}`}><div className="font-serif text-xl">{item.label}</div><div className={`mt-1 text-xs leading-5 ${perspective === item.id ? "text-neutral-300" : "text-neutral-500"}`}>{item.description}</div></button>)}
              </div>
              <textarea value={perspectiveNote} onChange={(event) => setPerspectiveNote(event.target.value)} placeholder="Optional: what do you want to say about it?" rows={4} className="mt-7 w-full resize-none border-b border-neutral-400 bg-transparent px-0 py-3 text-base leading-7 outline-none placeholder:text-neutral-400 focus:border-neutral-900" />
              <div className="mt-6 flex items-center justify-between gap-5"><span className="text-xs text-neutral-400">Your perspective stays yours.</span><button onClick={createPost} disabled={postLoading || !angle} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400">{postLoading ? "Writing..." : "Write the post →"}</button></div>
            </div>
          </div>
        </section>}

        {post && <section className="border-t border-neutral-900 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">05 / Write</div>
              <h2 className="mt-2 font-serif text-2xl">Your post.</h2>
              <p className="mt-3 text-xs leading-5 text-neutral-500">One clear idea, in your voice.</p>
            </div>
            <div className="max-w-3xl">
              <div className="whitespace-pre-wrap border-y border-neutral-300/80 py-8 font-serif text-xl leading-8 tracking-[-0.01em] sm:text-2xl sm:leading-9">{post}</div>
              <div className="mt-6 flex items-center justify-between"><span className="text-xs text-neutral-400">Ready to take with you.</span><div className="flex items-center gap-4">
                  <button
                    onClick={savePost}
                    disabled={saveLoading}
                    className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : "Save post →"}
                  </button>

                  <button
                    onClick={copyPost}
                    className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2"
                  >
                    {copied ? "Copied" : "Copy post →"}
                  </button>
                </div></div>
              {saveMessage && (
                <div className="mt-4 text-sm text-red-700">{saveMessage}</div>
              )}
            </div>
          </div>
        </section>}

        {error && <div className="border-t border-red-300 py-5 text-sm text-red-700">{error}</div>}
        <footer className="flex items-center justify-between border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400"><span>PostCraft AI</span><span>Find something worth saying.</span></footer>
      </div>
    </main>
  );
}














