"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Preview = {
  article: { title: string; source: string; publishedAt?: string; url: string };
  angle: { angle: string; why?: string };
  post: string;
  ranking?: { candidateCount?: number; reason?: string };
};

const STORAGE_KEY = "postcraft-active-daily-draft";
const nav = [
  ["Home", "/"], ["Write", "/create"], ["Auto-post", "/auto-post"],
  ["Auto-publish", "/auto-publish"], ["CommentCraft", "/commentcraft/import"],
  ["Workspace", "/workspace"], ["Billing", "/billing"],
];

export default function AutoPostPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [published, setPublished] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/auto-post/draft", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (data?.draft?.generated_post) {
          setPreview({ article: { title: data.draft.source_title, source: data.draft.source_name, url: data.draft.source_url }, angle: { angle: data.draft.recommended_angle || "", why: data.draft.angle_why || "" }, post: data.draft.working_post || data.draft.generated_post, ranking: { candidateCount: data.draft.candidate_count || undefined, reason: data.draft.ranking_reason || undefined } });
          setPublished(data.draft.status === "published");
          setHydrated(true);
          return;
        }
      } catch { /* fall back to local storage */ }
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setPreview(JSON.parse(saved));
      } catch { /* ignore malformed local draft */ }
      setHydrated(true);
    })();
  }, []);

  async function prepareDraft() {
    if (preview && !published) return;
    setRunning(true);
    setError("");
    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 180000);
      const response = await fetch("/api/auto-publish/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "AI & Technology" }),
        signal: controller.signal,
      });
      window.clearTimeout(timeout);
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "The draft could not be prepared.");
      if (!data?.post || !data?.article) throw new Error("The recommendation response was incomplete.");
      const saveResponse = await fetch("/api/auto-post/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: data }) });
      const savedData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(savedData?.error || "The draft could not be saved.");
      setPreview(data);
      setPublished(false);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      setError(err instanceof DOMException && err.name === "AbortError"
        ? "The recommendation took too long to respond. Check the server logs and try again."
        : err instanceof Error ? err.message : "Something went wrong while preparing the draft.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (hydrated && !preview) void prepareDraft();
  }, [hydrated]);

  async function copyPost() {
    if (!preview?.post) return;
    try {
      await navigator.clipboard.writeText(preview.post);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus(""), 2000);
    } catch { setCopyStatus("Copy failed"); }
  }

  async function publishPost() {
    if (!preview || published || publishStatus === "Publishing…") return;
    setPublishStatus("Publishing…");
    setError("");
    try {
      const response = await fetch("/api/linkedin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: preview.article.url,
          sourceTitle: preview.article.title,
          commentary: preview.post,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "The post could not be published.");
      setPublished(true);
      setPublishStatus("Published");
      await fetch("/api/auto-post/draft", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "published", linkedinPostId: data?.id || data?.postId || "" }) });
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      setPublishStatus("");
      setError(err instanceof Error ? err.message : "The post could not be published.");
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-neutral-300/80 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3"><span className="font-serif text-2xl font-semibold tracking-[-0.04em]">POSTCRAFT</span><span className="hidden border-l border-neutral-300 pl-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">AI editorial automation</span></Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Main navigation">{nav.map(([label, href]) => <Link key={href} href={href} className={label === "Auto-post" ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}>{label}</Link>)}</nav>
        </header>
        <section className="border-b border-neutral-300/80 py-12 lg:py-16">
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Create · AI-assisted editorial workflow</div>
          <h1 className="max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-7xl">Your next useful post,<br />prepared for you.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600">Discover a verified AI story, choose a useful perspective, and review a LinkedIn-ready draft before publishing.</p>
          <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={prepareDraft} disabled={running || (!!preview && !published)} className="bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400">{running ? "Preparing draft…" : preview && !published ? "Draft locked" : "Prepare today’s post →"}</button><Link href="/create" className="border border-neutral-300 bg-white/50 px-5 py-3 text-sm">Write manually</Link></div>
        </section>
        <section className="grid gap-8 border-b border-neutral-300/80 py-10 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-6"><div><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">How it works</div><p className="mt-3 text-sm leading-6 text-neutral-600">Auto-post prepares one draft for your review. Once generated, the draft is locked until it is published.</p></div><div className="border-t border-neutral-300 pt-5 text-xs leading-6 text-neutral-500"><strong className="text-neutral-900">Next step:</strong><br /><Link href="/auto-publish" className="underline underline-offset-4">Configure daily automation →</Link></div></aside>
          <div className="min-w-0"><div className="flex items-end justify-between gap-4 border-b border-neutral-300 pb-5"><div><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Today’s recommendation</div><h2 className="mt-2 font-serif text-3xl tracking-[-0.03em] sm:text-4xl">One story. One clear point.</h2></div>{preview && <span className={`rounded-full px-3 py-1 text-[10px] font-medium ${published ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{published ? "Published" : "Draft locked"}</span>}</div>
            {error && <div className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-800"><div className="font-medium">We couldn’t complete the action.</div><p className="mt-1 leading-6">{error}</p><button type="button" onClick={prepareDraft} disabled={running || (!!preview && !published)} className="mt-3 font-medium underline underline-offset-4">Try again →</button></div>}
            {!preview && running && <div className="mt-6 border border-neutral-300 bg-white/60 p-8"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Preparing your draft</div><h3 className="mt-5 font-serif text-3xl">Finding today’s strongest AI story…</h3><p className="mt-3 text-sm leading-6 text-neutral-600">PostCraft is checking current sources, selecting a useful angle, and generating a LinkedIn-ready post.</p></div>}
            {!preview && !running && !error && <div className="mt-6 border border-dashed border-neutral-300 p-8"><h3 className="font-serif text-3xl">Your recommended post will appear here.</h3></div>}
            {preview && <div className="mt-6 space-y-6"><div className="border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>🔒 Draft locked.</strong> This generated recommendation cannot be replaced until it has been published.</div><article className="border border-neutral-300 bg-white/70 p-6 sm:p-8"><div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500"><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Verified source</span><span>{preview.article.source}</span><span>·</span><span>{preview.article.publishedAt || "Date unavailable"}</span></div><h3 className="mt-5 max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">{preview.article.title}</h3>{preview.ranking?.reason && <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">{preview.ranking.reason}</p>}<a href={preview.article.url} target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs font-medium underline underline-offset-4">Read original source →</a></article><div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]"><div className="border border-neutral-300 bg-white/50 p-6"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Recommended angle</div><p className="mt-4 text-lg leading-7">{preview.angle?.angle}</p>{preview.angle?.why && <p className="mt-4 text-sm leading-6 text-neutral-500">{preview.angle.why}</p>}</div><div className="border border-neutral-300 bg-[#171717] p-6 text-white sm:p-8"><div className="flex items-center justify-between gap-3"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">Generated LinkedIn post</div><span className="text-[10px] text-neutral-400">{published ? "Published" : "Locked for review"}</span></div><pre className="mt-6 whitespace-pre-wrap font-serif text-lg leading-8 text-neutral-100 sm:text-xl">{preview.post}</pre><div className="mt-7 flex flex-wrap items-center gap-4 border-t border-white/15 pt-5"><button type="button" onClick={copyPost} disabled={published} className="bg-white px-4 py-2.5 text-xs font-medium text-neutral-900 disabled:opacity-50">Copy post</button><button type="button" onClick={publishPost} disabled={published || publishStatus === "Publishing…"} className="bg-emerald-500 px-4 py-2.5 text-xs font-medium text-white disabled:opacity-50">{publishStatus || "Publish to LinkedIn"}</button>{copyStatus && <span className="text-xs text-emerald-300">{copyStatus}</span>}</div></div></div></div>}
          </div>
        </section>
      </div>
    </main>
  );
}
