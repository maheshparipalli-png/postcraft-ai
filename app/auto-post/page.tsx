"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type VisualCopy = { headline: string; body: string; attribution: string };
type Preview = {
  article: { title: string; source: string; publishedAt?: string; url: string };
  angle?: { angle: string; why?: string };
  post: string;
  visual?: VisualCopy;
  ranking?: { candidateCount?: number; reason?: string };
};
type PublishFormat = "combined" | "text" | "image";
type AutoRunFailure = { error?: string; attempts?: number; details?: string[] };

const STORAGE_KEY = "postcraft-active-daily-draft";

function fallbackVisual(preview: Preview): VisualCopy {
  const text = preview.post.replace(/^This post is based on[^\n]*\n*/i, "").trim();
  const headline = text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() || "A considered point of view on AI and technology.";
  return {
    headline: headline.replace(/[.!?]+$/, ""),
    body: text === headline ? "" : text.replace(headline, "").trim().slice(0, 280),
    attribution: `Based on a ${preview.article.source} article`,
  };
}

async function renderVisual(visual: VisualCopy) {
  const width = 1080;
  const margin = 72;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser could not create the visual post.");
  ctx.fillStyle = "#171717";
  ctx.fillRect(0, 0, width, canvas.height);
  ctx.fillStyle = "#a3a3a3";
  ctx.font = "16px Arial";
  ctx.letterSpacing = "4px";
  ctx.fillText("POSTCRAFT · LINKEDIN VISUAL", margin, 82);
  ctx.fillStyle = "#f5f5f5";
  ctx.font = "700 42px Georgia";
  const headline = visual.headline.match(/.{1,42}(?:\s|$)/g) || [visual.headline];
  headline.slice(0, 4).forEach((line, index) => ctx.fillText(line.trim(), margin, 190 + index * 54));
  ctx.fillStyle = "#e7e5e4";
  ctx.font = "31px Georgia";
  const body = visual.body.match(/.{1,54}(?:\s|$)/g) || [visual.body];
  const bodyY = 190 + Math.min(headline.length, 4) * 54 + 65;
  body.slice(0, 7).forEach((line, index) => ctx.fillText(line.trim(), margin, bodyY + index * 43));
  const divider = bodyY + Math.min(body.length, 7) * 43 + 24;
  ctx.strokeStyle = "#3f3f46";
  ctx.beginPath(); ctx.moveTo(margin, divider); ctx.lineTo(width - margin, divider); ctx.stroke();
  ctx.fillStyle = "#a3a3a3";
  ctx.font = "18px Arial";
  ctx.fillText(visual.attribution, margin, divider + 34);
  ctx.fillStyle = "#737373";
  ctx.font = "16px Arial";
  ctx.fillText("A considered point of view, prepared with PostCraft AI", margin, divider + 78);
  return canvas.toDataURL("image/png");
}

export default function AutoPostPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [errorDetails, setErrorDetails] = useState<string[]>([]);
  const [attemptCount, setAttemptCount] = useState<number | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [published, setPublished] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [format, setFormat] = useState<PublishFormat>("combined");
  const [visualUrl, setVisualUrl] = useState("");
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/auto-post/draft", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (data?.draft?.generated_post) {
          setPreview({
            article: { title: data.draft.source_title, source: data.draft.source_name || "Unknown source", url: data.draft.source_url, publishedAt: data.draft.created_at },
            angle: { angle: data.draft.recommended_angle || "", why: data.draft.angle_why || "" },
            post: data.draft.working_post || data.draft.generated_post,
            ranking: { candidateCount: data.draft.candidate_count || undefined, reason: data.draft.ranking_reason || undefined },
          });
          setPublished(data.draft.status === "published");
          setHydrated(true);
          return;
        }
      } catch {}
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setPreview(JSON.parse(saved));
      } catch {}
      setHydrated(true);
    })();
  }, []);

  async function prepareDraft(force = false) {
    if (preview && !published && !force) return;
    setRunning(true);
    setError("");
    setErrorDetails([]);
    setAttemptCount(null);
    setVisualUrl("");
    setPublishStatus("");
    try {
      const response = await fetch("/api/auto-publish/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "AI & Technology" }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const failure = data as AutoRunFailure | null;
        setAttemptCount(typeof failure?.attempts === "number" ? failure.attempts : null);
        setErrorDetails(Array.isArray(failure?.details) ? failure.details.filter((item): item is string => typeof item === "string") : []);
        throw new Error(failure?.error || "The draft could not be prepared.");
      }
      const saveResponse = await fetch("/api/auto-post/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: data, replace: force }) });
      const savedData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(savedData?.error || "The draft could not be saved.");
      setPreview(data); setPublished(false); window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while preparing the draft.");
    } finally { setRunning(false); }
  }

  useEffect(() => { if (hydrated && !preview) void prepareDraft(); }, [hydrated]);

  async function regenerateDraft() {
    if (running) return;
    const message = published
      ? "Generate a new draft? The already-published post will remain unchanged."
      : "Regenerate today's draft? The current unsent draft will be replaced.";
    if (window.confirm(message)) await prepareDraft(true);
  }

  async function selectFormat(next: PublishFormat) {
    setFormat(next); setError("");
    if ((next === "combined" || next === "image") && preview && !visualUrl) {
      setRendering(true);
      try { setVisualUrl(await renderVisual(preview.visual || fallbackVisual(preview))); }
      catch (err) { setFormat("text"); setError(err instanceof Error ? err.message : "Could not render the visual post."); }
      finally { setRendering(false); }
    }
  }

  async function copyPost() {
    if (!preview?.post) return;
    try { await navigator.clipboard.writeText(preview.post); setCopyStatus("Copied"); window.setTimeout(() => setCopyStatus(""), 2000); }
    catch { setCopyStatus("Copy failed"); }
  }

  async function publishPost() {
    if (!preview || published || publishStatus === "Publishing...") return;
    setPublishStatus("Publishing..."); setError("");
    try {
      const imageDataUrl = format === "text" ? undefined : visualUrl || await renderVisual(preview.visual || fallbackVisual(preview));
      const response = await fetch("/api/linkedin/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUrl: preview.article.url, sourceTitle: preview.article.title, commentary: preview.post, imageDataUrl }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "The post could not be published.");
      setPublished(true); setPublishStatus("Published");
      await fetch("/api/auto-post/draft", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "published", linkedinPostId: data?.id || data?.postId || "" }) });
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) { setPublishStatus(""); setError(err instanceof Error ? err.message : "The post could not be published."); }
  }

  const visual = preview ? preview.visual || fallbackVisual(preview) : null;
  const statusLabel = running ? "Regenerating draft…" : published ? "Published" : preview ? "Ready for review" : error ? "Preparation failed" : "Preparing draft…";

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-neutral-300/80 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3"><span className="font-serif text-2xl font-semibold tracking-[-0.04em]">POSTCRAFT</span><span className="hidden border-l border-neutral-300 pl-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">AI editorial automation</span></Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Main navigation">{[["Home","/"],["Write","/create"],["Auto-post","/auto-post"],["Auto-publish","/auto-publish"],["CommentCraft","/commentcraft/import"],["Workspace","/workspace"],["Billing","/billing"]].map(([label, href]) => <Link key={href} href={href} className={label === "Auto-post" ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}>{label}</Link>)}</nav>
        </header>

        <section className="border-b border-neutral-300/80 py-12 lg:py-16"><div className="max-w-3xl"><p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Daily editorial workflow</p><h1 className="max-w-2xl font-serif text-5xl leading-[0.95] tracking-[-0.055em] sm:text-7xl">One thoughtful post.<br />Ready when you are.</h1><p className="mt-6 max-w-xl text-base leading-7 text-neutral-600">Review today’s selected story, refine the draft if needed, choose your publishing format, and send it to LinkedIn.</p><div className="mt-8 flex flex-wrap items-center gap-3"><button onClick={() => void prepareDraft()} disabled={running || (!!preview && !published)} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{running ? "Regenerating draft…" : preview && !published ? "Draft ready" : "Prepare today’s post →"}</button>{preview && <button onClick={() => void regenerateDraft()} disabled={running} className="rounded-full border border-neutral-400 px-5 py-3 text-sm font-medium text-neutral-800 disabled:cursor-not-allowed disabled:opacity-50">{running ? "Regenerating…" : "Regenerate draft"}</button>}<Link href="/create" className="rounded-full px-4 py-3 text-sm text-neutral-600 hover:text-neutral-900">Write manually</Link></div></div></section>

        <section className="border-b border-neutral-300/80 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Today’s recommendation</p><p className="mt-2 text-sm text-neutral-600">{running ? "Finding and shaping a timely point of view…" : published ? "This draft has already been published to LinkedIn." : preview ? "Review the source and perspective before publishing." : error ? "Automatic preparation failed. Review the diagnostic details and retry." : "Preparing your daily draft…"}</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-medium ${running ? "bg-blue-100 text-blue-800" : published ? "bg-blue-100 text-blue-800" : error ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>{statusLabel}</span></div>{error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700"><p>{error}</p>{attemptCount !== null && <p className="mt-2 text-xs text-red-600">Attempts: {attemptCount}</p>}{errorDetails.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-medium">Show diagnostic details</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-xs">{errorDetails.map((detail, index) => <li key={`${detail}-${index}`}>{detail}</li>)}</ul></details>}<button type="button" onClick={() => void prepareDraft(true)} disabled={running} className="mt-4 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-medium text-red-800 disabled:cursor-not-allowed disabled:opacity-50">{running ? "Retrying…" : "Retry now"}</button></div>}</section>

        {preview && <div className="grid gap-10 py-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16"><section><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Selected source</p><h2 className="mt-4 font-serif text-3xl leading-tight tracking-[-0.035em]">{preview.article.title}</h2><p className="mt-3 text-sm text-neutral-500">{preview.article.source}</p>{preview.angle?.angle && <div className="mt-8 border-l-2 border-neutral-900 pl-4"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Recommended angle</p><p className="mt-2 text-base leading-6">{preview.angle.angle}</p>{preview.angle.why && <p className="mt-2 text-sm leading-6 text-neutral-500">{preview.angle.why}</p>}</div>}<a href={preview.article.url} target="_blank" rel="noreferrer" className="mt-8 inline-flex text-sm font-medium underline underline-offset-4">Read source article ↗</a></section><section><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Publishing format</p><p className="mt-2 text-sm text-neutral-600">Choose what will be sent to LinkedIn.</p></div><div className="flex flex-wrap gap-2">{([["combined","Text + visual"],["text","Text only"],["image","Visual only"]] as const).map(([value,label]) => <button key={value} onClick={() => void selectFormat(value)} className={`rounded-full border px-3 py-2 text-xs font-medium ${format === value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-600"}`}>{label}</button>)}</div></div>{(format === "combined" || format === "image") && <div className="mt-6 overflow-hidden rounded-2xl bg-neutral-900">{rendering ? <div className="flex aspect-[3/2] items-center justify-center text-sm text-neutral-400">Preparing visual…</div> : visualUrl ? <img src={visualUrl} alt={visual?.headline || "Generated LinkedIn visual"} className="h-auto w-full" /> : <div className="flex aspect-[3/2] items-center justify-center text-sm text-neutral-400">Select a visual format to preview.</div>}</div>}{format !== "image" && <div className="mt-6 rounded-2xl border border-neutral-300 bg-white/60 p-5"><div className="mb-4 flex items-center justify-between gap-3"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Draft commentary</p><button onClick={() => void copyPost()} className="text-xs font-medium text-neutral-600 hover:text-neutral-900">{copyStatus || "Copy text"}</button></div><p className="whitespace-pre-wrap text-[15px] leading-7 text-neutral-800">{preview.post}</p></div>}<div className="mt-6 flex flex-wrap items-center gap-3"><button onClick={() => void publishPost()} disabled={published || running || rendering || publishStatus === "Publishing..."} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{published ? "Published" : publishStatus || "Publish to LinkedIn →"}</button><button onClick={() => void regenerateDraft()} disabled={running} className="rounded-full border border-neutral-300 px-5 py-3 text-sm font-medium text-neutral-700 disabled:cursor-not-allowed disabled:opacity-50">{running ? "Regenerating…" : "Regenerate"}</button><span className="text-xs text-neutral-500">{published ? "Your draft is locked after publishing." : "You can regenerate until you publish."}</span></div></section></div>}
        {!preview && <section className="py-20 text-center text-sm text-neutral-500">{running ? "Preparing your daily draft…" : "No draft is ready yet."}</section>}
        <footer className="border-t border-neutral-300/80 py-8 text-xs text-neutral-500">PostCraft AI · Review before you publish.</footer>
      </div>
    </main>
  );
}
