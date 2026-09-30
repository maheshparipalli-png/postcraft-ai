"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IDEA_CATEGORIES } from "@/lib/idea-radar/sources";

type Angle = { id: string; angle: string; why: string; evidence: string };
type Idea = {
  id: string;
  title: string;
  description: string;
  why_interesting: string;
  insight: string;
  category: string;
  source_name: string;
  source_url: string;
  published_at: string | null;
  status: string;
  created_at: string;
  idea_radar_angles: Angle[];
  actions: string[];
};

export default function IdeasPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [category, setCategory] = useState("All");
  const [savedOnly, setSavedOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [selectedAngle, setSelectedAngle] = useState<Record<string, string>>({});
  const [generatedPost, setGeneratedPost] = useState("");

  async function loadIdeas() {
    setLoading(true);
    setMessage("");
    try {
      const params = new URLSearchParams();
      if (category !== "All") params.set("category", category);
      if (savedOnly) params.set("saved", "true");
      const response = await fetch("/api/ideas?" + params.toString(), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to load Idea Radar.");
      setIdeas(data.ideas ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Idea Radar.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadIdeas(); }, [category, savedOnly]);

  async function refresh() {
    setRefreshing(true);
    setMessage("");
    try {
      const response = await fetch("/api/ideas/refresh", { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Refresh failed.");
      const sourceSummary = `${data.sourceSuccesses ?? 0}/${data.sources ?? 0} sources returned stories`;
      const currentSummary = `${data.currentIdeasCreated ?? 0} current stories added`;
      const evergreenSummary = `${data.evergreenIdeasCreated ?? 0} evergreen ideas added`;
      const failureSummary = data.sourceFailures || data.ideaErrors?.length
        ? ` ${data.sourceFailures ?? 0} feed failures, ${data.ideaErrors?.length ?? 0} idea errors.`
        : "";
      const aiSummary = data.aiAnalysisDisabled
        ? " AI enrichment is temporarily disabled; ready-made angles are still available."
        : "";
      await loadIdeas();
      setMessage(`Radar refreshed: ${sourceSummary}; ${currentSummary}; ${evergreenSummary}.${failureSummary}${aiSummary}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  }

  async function action(ideaId: string, actionName: "save" | "hide" | "used" | "angles") {
    setBusy(ideaId + actionName);
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: actionName, ideaId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Action failed.");
      if (actionName === "angles") {
        setIdeas((current) => current.map((idea) => idea.id === ideaId ? {
          ...idea,
          idea_radar_angles: data.angles ?? [],
        } : idea));
      } else {
        await loadIdeas();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
    } finally {
      setBusy("");
    }
  }

  async function generatePost(idea: Idea) {
    const angleId = selectedAngle[idea.id] || idea.idea_radar_angles[0]?.id;
    if (!angleId) {
      setMessage("Select an angle first.");
      return;
    }
    setBusy(idea.id + "post");
    setGeneratedPost("");
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate-post", ideaId: idea.id, angleId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Post generation failed.");
      setGeneratedPost(data.post || "");
      await loadIdeas();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Post generation failed.");
    } finally {
      setBusy("");
    }
  }

  const formatDate = (value: string | null) => value
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value))
    : "";

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-7 border-b border-neutral-300 pb-9 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500">Insight discovery engine</div>
            <h1 className="mt-3 font-serif text-5xl tracking-[-0.045em] sm:text-6xl">Idea Radar</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
              Discover ideas worth talking about, find the insight beneath them, and turn one selected angle into an original LinkedIn post.
            </p>
          </div>
          <button onClick={refresh} disabled={refreshing} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">
            {refreshing ? "Refreshing…" : "Refresh Radar"}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-neutral-300 py-5">
          {["All", ...IDEA_CATEGORIES].map((item) => (
            <button key={item} onClick={() => setCategory(item)} className={category === item ? "rounded-full bg-neutral-900 px-3 py-2 text-xs text-white" : "rounded-full border border-neutral-300 px-3 py-2 text-xs text-neutral-600 hover:border-neutral-900"}>
              {item}
            </button>
          ))}
          <button onClick={() => setSavedOnly((value) => !value)} className={savedOnly ? "rounded-full bg-neutral-900 px-3 py-2 text-xs text-white" : "rounded-full border border-neutral-300 px-3 py-2 text-xs text-neutral-600"}>
            Saved
          </button>
        </div>

        {message && <div className="my-5 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm text-neutral-700">{message}</div>}

        {generatedPost && (() => {
          const blocks = generatedPost.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
          const cardHeadline = blocks[0] || "Your main idea";
          const cardBody = blocks.slice(1, Math.max(2, blocks.length - 1)).join("\n\n") || blocks[1] || "";
          const cardClosing = blocks.length > 2 ? blocks[blocks.length - 1] : "";
          return (
            <section className="my-7 grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
              <div className="rounded-2xl border border-neutral-300 bg-white p-6 sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Generated LinkedIn post</div>
                <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7">{generatedPost}</div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button onClick={() => navigator.clipboard?.writeText(generatedPost)} className="rounded-full border border-neutral-300 px-4 py-2 text-xs font-medium hover:border-neutral-900">Copy post</button>
                  <button
                    onClick={() => {
                      window.sessionStorage.setItem(
                        "postcraft-idea-radar-postcard",
                        JSON.stringify({
                          headline: cardHeadline,
                          body: cardBody,
                          closing: cardClosing,
                          template: "thought",
                        }),
                      );
                      window.location.href = "/postcard?source=idea-radar";
                    }}
                    className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white"
                  >
                    Open in PostCard Studio →
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-neutral-300 bg-[#151515] p-6 text-white sm:p-8">
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">PostCard</div>
                <div className="mt-12 flex min-h-[430px] flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">THOUGHT EXPERIMENT</div>
                    <h3 className="mt-7 font-serif text-4xl leading-[1.02] tracking-[-0.03em]">{cardHeadline}</h3>
                    {cardBody && <p className="mt-7 whitespace-pre-wrap text-sm leading-6 text-neutral-300">{cardBody}</p>}
                  </div>
                  {cardClosing && (
                    <div className="mt-8 border-t border-white/20 pt-5 text-sm font-medium leading-6 text-white">
                      {cardClosing}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })()}

        {loading ? (
          <div className="py-20 text-center text-sm text-neutral-500">Loading ideas…</div>
        ) : ideas.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="font-serif text-3xl">No ideas yet.</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-500">Refresh Radar to explore current developments and evergreen ideas across the topics you care about.</p>
            <button onClick={refresh} disabled={refreshing} className="mt-6 rounded-full bg-neutral-900 px-5 py-3 text-sm text-white">Find ideas</button>
          </div>
        ) : (
          <div className="grid gap-5 pt-7 lg:grid-cols-2">
            {ideas.map((idea) => (
              <article key={idea.id} className="rounded-2xl border border-neutral-300 bg-white p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600">{idea.category}</span>
                    <span className="rounded-full border border-neutral-200 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                      {idea.source_url ? "Current" : "Evergreen"}
                    </span>
                  </div>
                  <span className="text-[11px] text-neutral-400">{formatDate(idea.published_at)}</span>
                </div>
                <h2 className="mt-5 font-serif text-2xl leading-tight tracking-[-0.025em]">{idea.title}</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">{idea.description}</p>

                <div className="mt-5 border-t border-neutral-200 pt-5">
                  <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Why this is interesting</div>
                  <p className="mt-2 text-sm leading-6">{idea.why_interesting}</p>
                </div>

                <div className="mt-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Underlying insight</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-700">{idea.insight}</p>
                </div>

                <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
                  <span className="text-xs text-neutral-500">{idea.source_name}</span>
                  {idea.source_url ? (
                    <Link href={idea.source_url} target="_blank" rel="noreferrer" className="text-xs font-medium underline underline-offset-4">Open source →</Link>
                  ) : (
                    <span className="text-xs text-neutral-400">Evergreen library</span>
                  )}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={() => action(idea.id, "angles")} disabled={busy === idea.id + "angles"} className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium disabled:opacity-50">
                    {busy === idea.id + "angles" ? "Generating…" : "Generate 5 Angles"}
                  </button>
                  <button onClick={() => action(idea.id, "save")} disabled={busy === idea.id + "save"} className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium">
                    {idea.actions.includes("saved") ? "Saved" : "Save"}
                  </button>
                  <button onClick={() => action(idea.id, "hide")} className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium">Hide</button>
                  <button onClick={() => action(idea.id, "used")} className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium">Mark Used</button>
                </div>

                {idea.idea_radar_angles?.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-400">Possible angles</div>
                    {idea.idea_radar_angles.map((angle) => (
                      <label key={angle.id} className={selectedAngle[idea.id] === angle.id ? "block cursor-pointer rounded-xl border border-neutral-900 bg-neutral-50 p-3" : "block cursor-pointer rounded-xl border border-neutral-200 p-3 hover:border-neutral-400"}>
                        <div className="flex gap-3">
                          <input type="radio" name={`angle-${idea.id}`} checked={selectedAngle[idea.id] === angle.id} onChange={() => setSelectedAngle((current) => ({ ...current, [idea.id]: angle.id }))} className="mt-1" />
                          <div>
                            <div className="text-sm font-medium">{angle.angle}</div>
                            <div className="mt-1 text-xs leading-5 text-neutral-500">{angle.why}</div>
                          </div>
                        </div>
                      </label>
                    ))}
                    <button onClick={() => generatePost(idea)} disabled={busy === idea.id + "post"} className="rounded-full bg-neutral-900 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">
                      {busy === idea.id + "post" ? "Writing post…" : "Generate Post"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
