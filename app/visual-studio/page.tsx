"use client";

import Link from "next/link";
import NextImage from "next/image";
import { useMemo, useState } from "react";
import type { VisualStorytellingPlan } from "@/lib/postcard/visual-storytelling";
import { VISUAL_STYLE_OPTIONS, type VisualStyle } from "@/lib/postcard/visual-styles";

type SourceMode = "linkedin" | "idea";

type VisualPlan = VisualStorytellingPlan;

function deriveContent(source: string, mode: SourceMode) {
  const clean = source.trim();
  if (!clean) return { headline: "", body: "", closing: "" };

  const paragraphs = clean.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const lines = clean.split("\n").map((line) => line.trim()).filter(Boolean);

  if (mode === "linkedin") {
    const headline = lines[0] || paragraphs[0] || clean;
    const rest = lines.slice(1).join(" ").trim() || paragraphs.slice(1).join(" ").trim();
    return {
      headline: headline.length > 180 ? headline.slice(0, 177) + "..." : headline,
      body: rest || headline,
      closing: "",
    };
  }

  const firstSentence = clean.match(/^(.+?[.!?])(?:\s|$)/)?.[1] || clean;
  const headline = firstSentence.length > 140 ? firstSentence.slice(0, 137) + "..." : firstSentence;
  const body = clean === firstSentence ? clean : clean.slice(firstSentence.length).trim();
  return { headline, body: body || clean, closing: "" };
}

export default function VisualStudioPage() {
  const [mode, setMode] = useState<SourceMode>("idea");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("editorial");
  const [source, setSource] = useState("");
  const [plan, setPlan] = useState<VisualPlan | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [storagePath, setStoragePath] = useState<string | null>(null);
  const [generatedModel, setGeneratedModel] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);

  const derived = useMemo(() => deriveContent(source, mode), [source, mode]);

  async function analyzeIdea() {
    if (!source.trim()) return;
    setPlan(null);
    setImageUrl(null);
    setStoragePath(null);
    setGeneratedModel(null);
    setSavedId(null);
    setMessage("Understanding your idea and developing the visual direction…");

    try {
      const response = await fetch("/api/ai/visual-storytelling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: derived.headline,
          body: derived.body,
          closing: derived.closing,
          visualStyle,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.plan) {
        throw new Error(data?.error || "Could not develop the visual direction.");
      }
      setPlan(data.plan);
      setMessage("AI developed one visual direction. Review it before generating the visual.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not develop the visual direction.");
    }
  }

  async function generateVisual() {
    if (!plan) return;
    setGenerating(true);
    setMessage("");

    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: plan.imagePrompt,
          model: plan.preferredModel,
          width: 1200,
          height: 1500,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not generate the visual.");

      const image = data?.images?.[0];
      if (!image?.url) throw new Error("The image was generated but no stored image URL was returned.");

      setImageUrl(image.url);
      setStoragePath(image.storagePath || null);
      setGeneratedModel(data?.model || null);
      setMessage("Visual generated and stored. The motivational sentence stays outside the image.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not generate the visual.");
    } finally {
      setGenerating(false);
    }
  }

  async function savePostCard() {
    if (!plan || !imageUrl) return;
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/postcard/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template: "thought",
          background: "minimal",
          name: "",
          handle: "",
          headline: derived.headline,
          body: derived.body,
          closing: plan.motivationalSentence,
          source: mode === "linkedin" ? "Visual Studio · LinkedIn post" : "Visual Studio · My idea",
          imageUrl,
          imageStoragePath: storagePath,
          visualPrompt: plan.imagePrompt,
          motivationalSentence: plan.motivationalSentence,
          visualConcept: plan.visualConcept,
          visualStyle: plan.visualStyle,
          imageModel: generatedModel,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not save the PostCard.");
      setSavedId(data.id || null);
      setMessage("Saved to your PostCards.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save the PostCard.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-neutral-950">
      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <header className="border-b border-neutral-300/80 py-5">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-400">PostCard</div>
              <h1 className="mt-2 font-serif text-4xl tracking-[-0.04em] sm:text-6xl">Visual Studio</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
                Turn a human idea or LinkedIn post into a visual PostCard.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <Link href="/postcard/saved" className="rounded-full border border-neutral-300 bg-white px-4 py-2.5 font-medium hover:border-neutral-900">Saved PostCards</Link>
              <Link href="/postcard" className="px-2 py-2.5 font-medium text-neutral-500 hover:text-neutral-950">Classic editor</Link>
            </div>
          </div>
        </header>

        <section className="grid gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <div className="inline-flex rounded-full border border-neutral-300 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => { setMode("idea"); setPlan(null); setImageUrl(null); setStoragePath(null); setGeneratedModel(null); setMessage(""); }}
                className={mode === "idea" ? "rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white" : "rounded-full px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-950"}
              >
                From my idea
              </button>
              <button
                type="button"
                onClick={() => { setMode("linkedin"); setPlan(null); setImageUrl(null); setMessage(""); }}
                className={mode === "linkedin" ? "rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white" : "rounded-full px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-950"}
              >
                From LinkedIn
              </button>
            </div>

            <div className="mt-5 border-y border-neutral-300/80 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                    {mode === "idea" ? "Your idea" : "LinkedIn post"}
                  </div>
                  <h2 className="mt-1 font-serif text-xl tracking-[-0.02em]">
                    {mode === "idea" ? "What do you want to say?" : "What should the visual communicate?"}
                  </h2>
                </div>
                <div className="text-[11px] text-neutral-400">{source.length} characters</div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-400">Visual style</span>
                {VISUAL_STYLE_OPTIONS.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => {
                      setVisualStyle(style.id);
                      setImageUrl(null);
                      setStoragePath(null);
                      setSavedId(null);
                      setGeneratedModel(null);
                      setPlan(null);
                      setMessage(source.trim()
                        ? "Style changed. Extract the visual idea again so AI can develop the direction for this style."
                        : "Style selected. Extract the visual idea when you are ready.");
                    }}
                    className={visualStyle === style.id
                      ? "rounded-full bg-neutral-900 px-3 py-1.5 text-[11px] font-semibold text-white"
                      : "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-600 hover:border-neutral-900 hover:text-neutral-950"}
                  >
                    {style.label}
                  </button>
                ))}
              </div>

              <textarea
                value={source}
                onChange={(event) => { setSource(event.target.value); setPlan(null); setImageUrl(null); setStoragePath(null); setGeneratedModel(null); setSavedId(null); }}
                placeholder={mode === "idea"
                  ? "Example: Progress is not always about moving faster. Sometimes it is about staying on the path when nobody is watching."
                  : "Paste your LinkedIn post here..."}
                rows={6}
                className="mt-4 w-full resize-y rounded-xl border border-neutral-300 bg-white p-4 text-[15px] leading-6 outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/5"
              />

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={analyzeIdea}
                  disabled={!source.trim()}
                  className="rounded-full bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Extract visual idea →
                </button>
                <span className="text-xs text-neutral-500">AI analysis · one idea · one tension · one visual metaphor</span>
              </div>
            </div>

            {plan && (
              <div className="mt-6">
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Creative direction</div>
                    <p className="mt-1 text-xs text-neutral-500">One message. One human insight. One visual metaphor.</p>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Ready</span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
                  <div className="border-b border-neutral-200 p-5 sm:p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Core idea</div>
                    <p className="mt-2 max-w-2xl text-lg font-medium leading-7">{plan.coreTheme}</p>
                  </div>
                  <div className="grid divide-y border-b border-neutral-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                    <div className="p-5 sm:p-6">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Human insight</div>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">{plan.emotionalMessage}</p>
                    </div>
                    <div className="p-5 sm:p-6">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Visual metaphor</div>
                      <p className="mt-2 text-sm leading-6 text-neutral-700">{plan.visualConcept}</p>
                    </div>
                  </div>
                  <div className="bg-[#f1eee7] p-5 sm:p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">PostCard sentence</div>
                    <p className="mt-2 max-w-2xl font-serif text-2xl leading-tight tracking-[-0.02em]">{plan.motivationalSentence}</p>
                    <p className="mt-2 text-xs text-neutral-500">Added by PostCraft after the image is generated.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={generateVisual}
                  disabled={generating}
                  className="w-full rounded-2xl bg-neutral-900 px-5 py-4 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {generating ? `Generating ${VISUAL_STYLE_OPTIONS.find((style) => style.id === visualStyle)?.label.toLowerCase() || "visual"}…` : imageUrl ? "Regenerate visual →" : `Generate ${VISUAL_STYLE_OPTIONS.find((style) => style.id === visualStyle)?.label.toLowerCase() || "visual"} →`}
                </button>
              </div>
            )}

            {message && (
              <div className="mt-5 border-l-2 border-neutral-900 px-4 py-2 text-sm leading-6 text-neutral-600">{message}</div>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="mb-3 flex items-end justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">Live composition</div>
                <p className="mt-1 text-xs text-neutral-500">4:5 composition · {VISUAL_STYLES.find((style) => style.id === visualStyle)?.label || "Editorial photo"} · 1200 × 1500</p>
              </div>
              {imageUrl && <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-green-700">Stored</span>}
            </div>

            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-900 shadow-[0_24px_70px_rgba(0,0,0,.12)]">
              {imageUrl ? (
                <div className="relative aspect-[4/5]">
                  <NextImage src={imageUrl} alt={plan?.visualConcept || "PostCraft generated visual"} fill sizes="(max-width: 1024px) 100vw, 320px" unoptimized className="object-cover" />
                  {plan?.motivationalSentence && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent px-6 pb-7 pt-20 sm:px-7 sm:pb-8">
                      <div className="max-w-[78%] font-serif text-2xl leading-[1.05] tracking-[-0.025em] text-white drop-shadow-[0_2px_10px_rgba(0,0,0,.55)] sm:text-3xl">
                        {plan.motivationalSentence}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[4/5] items-center justify-center bg-[#e9e5dc] p-7 text-center">
                  <div>
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-neutral-400 text-lg">✦</div>
                    <p className="mt-3 text-sm font-medium text-neutral-700">Your visual will appear here.</p>
                    <p className="mt-2 text-xs leading-5 text-neutral-500">Clean image first. PostCraft adds the message separately.</p>
                  </div>
                </div>
              )}
            </div>

            {plan && imageUrl && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={savePostCard}
                  disabled={saving || Boolean(savedId)}
                  className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold hover:border-neutral-900 disabled:opacity-50"
                >
                  {savedId ? "✓ Saved" : saving ? "Saving…" : "Save PostCard"}
                </button>
                {savedId ? (
                  <Link href={`/postcard/${savedId}`} className="rounded-xl bg-neutral-900 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-neutral-700">Open card →</Link>
                ) : (
                  <a href={imageUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-neutral-300 bg-white px-4 py-3 text-center text-sm font-semibold hover:border-neutral-900">Open image</a>
                )}
              </div>
            )}

            <div className="mt-5 border-t border-neutral-300 pt-5 text-xs leading-5 text-neutral-500">
              <strong className="font-semibold text-neutral-700">Design rule:</strong> message determines metaphor; metaphor determines image. The generated image contains no motivational text.
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
