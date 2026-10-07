"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SourceMode = "url" | "paste";

export default function CreatePostPage() {
  const router = useRouter();
  const [sourceMode, setSourceMode] = useState<SourceMode>("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [post, setPost] = useState("");
  const [cardPoints, setCardPoints] = useState<string[]>([]);
  const [cardTakeaway, setCardTakeaway] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [articleSource, setArticleSource] = useState("");
  const [articleUrl, setArticleUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [qualityPassed, setQualityPassed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function buildPost() {
    setError("");
    setCopied(false);
    setQualityPassed(false);

    if (sourceMode === "url" && !sourceUrl.trim()) {
      setError("Paste the public article URL first.");
      return;
    }

    if (sourceMode === "paste" && !sourceText.trim()) {
      setError("Paste the article or source material first.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "manualEditorial",
          sourceUrl: sourceMode === "url" ? sourceUrl.trim() : "",
          content: sourceMode === "paste" ? sourceText.trim() : "",
          title: title.trim(),
          source: source.trim(),
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok || typeof data?.post !== "string") {
        throw new Error(data?.error || "PostCraft could not build the editorial post.");
      }

      const points = Array.isArray(data.cardPoints)
        ? data.cardPoints.filter((point: unknown): point is string => typeof point === "string" && point.trim().length > 0)
        : [];

      const takeaway = typeof data.cardTakeaway === "string" ? data.cardTakeaway.trim() : "";
      const article = data.article || {};

      if (points.length !== 3 || !takeaway) {
        throw new Error("PostCraft could not create a validated factual PostCard for this source.");
      }

      setPost(data.post.trim());
      setCardPoints(points);
      setCardTakeaway(takeaway);
      setArticleTitle(typeof article.title === "string" ? article.title : title.trim());
      setArticleSource(typeof article.source === "string" ? article.source : source.trim() || "User provided source");
      setArticleUrl(typeof article.url === "string" ? article.url : sourceUrl.trim());
      setQualityPassed(true);
    } catch (err) {
      setPost("");
      setCardPoints([]);
      setCardTakeaway("");
      setQualityPassed(false);
      setError(err instanceof Error ? err.message : "PostCraft could not build the post.");
    } finally {
      setBusy(false);
    }
  }

  function openPostCard() {
    if (!post.trim() || cardPoints.length !== 3 || !cardTakeaway.trim()) return;

    window.sessionStorage.setItem(
      "postcraft-idea-radar-postcard",
      JSON.stringify({
        headline: articleTitle || "PostCraft Story",
        body: cardPoints.join("\n"),
        linkedinPost: post.trim(),
        closing: cardTakeaway.trim(),
        template: "story",
        source: articleSource || "User provided source",
        sourceUrl: articleUrl || "",
        origin: "create",
      }),
    );

    router.push("/postcard");
  }

  async function copyPost() {
    if (!post.trim()) return;

    try {
      await navigator.clipboard.writeText(post.trim());
      setCopied(true);
      setError("");
    } catch {
      setError("Could not copy automatically. You can select the post and copy it.");
    }
  }

  function clearAll() {
    setSourceUrl("");
    setSourceText("");
    setTitle("");
    setSource("");
    setPost("");
    setCardPoints([]);
    setCardTakeaway("");
    setArticleTitle("");
    setArticleSource("");
    setArticleUrl("");
    setQualityPassed(false);
    setError("");
    setCopied(false);
  }

  return (
    <main className="min-h-screen bg-[#f7f5f0] px-4 py-5 text-[#24251f] dark:bg-neutral-950 dark:text-neutral-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dedbd3] pb-4 dark:border-white/10">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">POSTCRAFT</Link>
            <span className="hidden text-[#b4afa4] sm:inline">/</span>
            <span className="hidden text-sm text-neutral-500 sm:inline">Editorial studio</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-neutral-500" aria-label="Main navigation">
            <Link href="/">Discover</Link>
            <Link href="/ideas">Idea Radar</Link>
            <span className="font-semibold text-[#24251f] dark:text-white">Write</span>
            <Link href="/visual-studio">Visual Studio</Link>
            <Link href="/workspace">Workspace</Link>
          </nav>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="rounded-full border border-[#d8d4cb] px-4 py-2 text-sm hover:bg-white dark:border-white/15 dark:hover:bg-white/5"
          >
            Back to workspace
          </button>
        </header>

        <section className="mx-auto max-w-4xl py-8 text-center sm:py-11">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#8b795c]">Your editorial desk</p>
          <h1 className="font-serif text-4xl leading-tight tracking-tight sm:text-5xl">Start with something worth saying.</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-neutral-600 dark:text-neutral-400 sm:text-lg">
            Bring an article or your own source material. PostCraft turns it into a LinkedIn point of view, then builds a factual PostCard from the source.
          </p>
        </section>

        {error && (
          <div role="alert" className="mx-auto mb-5 max-w-6xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-[#e2ded5] bg-white p-5 shadow-[0_8px_30px_rgba(45,39,27,0.035)] dark:border-white/10 dark:bg-neutral-900 sm:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b795c]">01 / The source</p>
              <h2 className="mt-2 font-serif text-2xl">Give PostCraft the material.</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-500">
                Use a public article URL, or paste the article/text yourself. Your source is the factual foundation for the PostCard.
              </p>
            </div>

            <div className="mt-6 flex rounded-xl bg-[#f2efe8] p-1 dark:bg-white/5">
              <button
                type="button"
                onClick={() => setSourceMode("url")}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${sourceMode === "url" ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-500"}`}
              >
                Public article URL
              </button>
              <button
                type="button"
                onClick={() => setSourceMode("paste")}
                className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-medium transition ${sourceMode === "paste" ? "bg-white text-neutral-900 shadow-sm dark:bg-neutral-800 dark:text-white" : "text-neutral-500"}`}
              >
                Paste source material
              </button>
            </div>

            {sourceMode === "url" ? (
              <div className="mt-5">
                <label htmlFor="article-url" className="text-sm font-medium">Article URL</label>
                <input
                  id="article-url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://www.example.com/article"
                  className="mt-2 w-full rounded-xl border border-[#e3dfd6] bg-[#fdfcf9] px-4 py-3.5 text-sm outline-none focus:border-[#9c8b6e] focus:ring-2 focus:ring-[#9c8b6e]/15 dark:border-white/15 dark:bg-neutral-950"
                />
                <p className="mt-2 text-xs leading-5 text-neutral-400">PostCraft will verify and read the original publisher page.</p>
              </div>
            ) : (
              <div className="mt-5">
                <label htmlFor="source-material" className="text-sm font-medium">Article or source material</label>
                <textarea
                  id="source-material"
                  value={sourceText}
                  onChange={(event) => setSourceText(event.target.value)}
                  placeholder={"Paste the article text here.\n\nYou can also paste your own notes or source material. PostCraft will treat what you provide as the factual source."}
                  rows={12}
                  className="mt-2 w-full resize-y rounded-xl border border-[#e3dfd6] bg-[#fdfcf9] px-4 py-4 text-sm leading-6 outline-none focus:border-[#9c8b6e] focus:ring-2 focus:ring-[#9c8b6e]/15 dark:border-white/15 dark:bg-neutral-950 dark:placeholder:text-neutral-600"
                />
              </div>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-medium">
                Article title <span className="font-normal text-neutral-400">Optional</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Leave blank for automatic detection"
                  className="mt-2 w-full rounded-lg border border-[#dedbd3] bg-white px-3 py-2.5 text-sm outline-none dark:border-white/15 dark:bg-neutral-950"
                />
              </label>
              <label className="block text-sm font-medium">
                Source name <span className="font-normal text-neutral-400">Optional</span>
                <input
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="For example: MIT Technology Review"
                  className="mt-2 w-full rounded-lg border border-[#dedbd3] bg-white px-3 py-2.5 text-sm outline-none dark:border-white/15 dark:bg-neutral-950"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={buildPost}
              disabled={busy || (sourceMode === "url" ? !sourceUrl.trim() : !sourceText.trim())}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl bg-[#292a24] px-5 py-4 text-sm font-semibold text-white transition hover:bg-[#414239] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              {busy ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-neutral-500 dark:border-t-neutral-900" />
                  Reading source and building your post…
                </>
              ) : (
                <>Build my LinkedIn post <span aria-hidden="true">→</span></>
              )}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-neutral-400">
              LinkedIn = your perspective. PostCard = facts from the source.
            </p>
          </section>

          <section className="rounded-2xl border border-[#e2ded5] bg-[#eeece5] p-4 dark:border-white/10 dark:bg-neutral-900 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3 px-1 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b795c]">02 / Your perspective</p>
                <h2 className="mt-2 font-serif text-2xl">Your LinkedIn post</h2>
                <p className="mt-1 text-sm text-neutral-500">The post is an interpretation of the source, not a copy of it.</p>
              </div>
              {qualityPassed && (
                <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                  Quality checked
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-[#e5e2dc] bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-950 sm:p-7">
              <div className="flex items-center gap-3 border-b border-[#eeece7] pb-4 dark:border-white/10">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e8e0d1] font-serif text-lg text-[#69583e]">P</div>
                <div>
                  <p className="text-sm font-semibold">Your LinkedIn post</p>
                  <p className="text-xs text-neutral-400">Review and edit before publishing</p>
                </div>
              </div>

              <label htmlFor="post-draft" className="sr-only">Edit your generated LinkedIn post</label>
              <textarea
                id="post-draft"
                value={post}
                onChange={(event) => {
                  setPost(event.target.value);
                  setQualityPassed(false);
                }}
                placeholder="Your generated LinkedIn perspective will appear here."
                rows={17}
                className="mt-5 min-h-[390px] w-full resize-y border-0 bg-transparent p-0 text-[15px] leading-7 outline-none placeholder:text-neutral-400 focus:ring-0 dark:placeholder:text-neutral-600"
              />
              <div className="mt-3 flex items-center justify-between border-t border-[#eeece7] pt-4 text-xs text-neutral-400 dark:border-white/10">
                <span>{post.trim() ? post.trim().split(/\s+/).length : 0} words</span>
                <span>{post.length} characters</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={buildPost} disabled={busy || (sourceMode === "url" ? !sourceUrl.trim() : !sourceText.trim())} className="rounded-lg border border-[#d7d2c7] bg-white px-4 py-2.5 text-sm font-medium hover:bg-[#faf9f6] disabled:opacity-50 dark:border-white/15 dark:bg-neutral-950">
                Regenerate
              </button>
              <button type="button" onClick={copyPost} disabled={!post.trim()} className="rounded-lg bg-[#292a24] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#414239] disabled:opacity-50 dark:bg-white dark:text-neutral-900">
                {copied ? "Copied" : "Copy post"}
              </button>
              <button type="button" onClick={clearAll} className="rounded-lg border border-[#d7d2c7] px-4 py-2.5 text-sm font-medium hover:bg-white dark:border-white/15 dark:hover:bg-white/5">
                Clear
              </button>
            </div>

            <div className="mt-6 border-t border-[#d8d4cb] pt-5 dark:border-white/10">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8b795c]">03 / PostCard</p>
                  <h3 className="mt-2 font-serif text-2xl">Factual content is ready.</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-neutral-500">
                    The PostCard will use concrete points from the source material, not the opinion in your LinkedIn post.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openPostCard}
                  disabled={!qualityPassed || cardPoints.length !== 3 || !cardTakeaway}
                  className="shrink-0 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open in PostCard →
                </button>
              </div>

              {qualityPassed && (
                <div className="mt-5 rounded-xl border border-[#ddd9d0] bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">POSTCARD PREVIEW</div>
                  <div className="mt-3 space-y-2">
                    {cardPoints.map((point) => (
                      <p key={point} className="text-sm leading-6 text-neutral-700 dark:text-neutral-300">• {point}</p>
                    ))}
                  </div>
                  <p className="mt-3 border-t border-[#e5e2dc] pt-3 text-sm font-medium leading-6 text-neutral-800 dark:border-white/10 dark:text-neutral-200">
                    {cardTakeaway}
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        <section className="mx-auto mt-8 max-w-4xl rounded-2xl border border-[#e2ded5] bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
          <div className="grid gap-5 text-sm sm:grid-cols-3">
            <div><p className="font-semibold">1. Bring the source</p><p className="mt-1 leading-6 text-neutral-500">Use a public article or paste the material you want to work from.</p></div>
            <div><p className="font-semibold">2. Build the perspective</p><p className="mt-1 leading-6 text-neutral-500">PostCraft turns the source into a clear LinkedIn point of view.</p></div>
            <div><p className="font-semibold">3. Keep the facts separate</p><p className="mt-1 leading-6 text-neutral-500">Your PostCard is generated independently from the source facts.</p></div>
          </div>
        </section>

        <footer className="py-7 text-center text-xs text-neutral-400">PostCraft · Your ideas, in your voice.</footer>
      </div>
    </main>
  );
}
