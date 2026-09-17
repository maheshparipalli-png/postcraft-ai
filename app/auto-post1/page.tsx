"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Article = {
  title: string;
  description?: string;
  whyItMatters?: string;
  source?: string;
  url: string;
  publishedAt?: string;
  qualityScore?: number;
  qualityReasons?: string[];
};

type SocialTrend = {
  title?: string;
  name?: string;
  url?: string;
  platform?: string;
  description?: string;
};

function scoreArticle(article: Article) {
  const text = `${article.title} ${article.description || ""}`;
  let score = 50;
  const reasons: string[] = [];
  if ((article.description || "").length >= 180) { score += 12; reasons.push("Substantial source context"); }
  else if ((article.description || "").length >= 80) { score += 7; reasons.push("Useful source context"); }
  if (/research|study|paper|benchmark|data|evidence|report/i.test(text)) { score += 12; reasons.push("Evidence or research signal"); }
  if (/model|agent|robot|chip|inference|reasoning|open source|release/i.test(text)) { score += 8; reasons.push("Concrete AI technology development"); }
  if (/how|why|impact|future|risk|business|work|security|governance/i.test(text)) { score += 8; reasons.push("Supports deeper discussion"); }
  if (/breaking|shocking|you won't believe|insane|secret/i.test(text)) { score -= 10; reasons.push("Sensational wording reduces confidence"); }
  return { score: Math.max(0, Math.min(100, score)), reasons };
}

export default function AutoPost1Page() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [trends, setTrends] = useState<SocialTrend[]>([]);
  const [trendStatus, setTrendStatus] = useState("Loading public AI trend signals…");

  const loadArticles = useCallback(async () => {
    setLoading(true); setError(""); setIndex(0); setComment("");
    try {
      const response = await fetch("/api/discover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "AI & Technology" }) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not load AI articles.");
      const ranked = (Array.isArray(data?.ideas) ? data.ideas : []).map((item: Article) => {
        const ranking = scoreArticle(item);
        return { ...item, qualityScore: ranking.score, qualityReasons: ranking.reasons };
      }).sort((a: Article, b: Article) => (b.qualityScore || 0) - (a.qualityScore || 0));
      setArticles(ranked);
      if (!ranked.length) throw new Error("No usable AI articles were returned.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load articles."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadArticles(); }, [loadArticles]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("https://whatstrending.ai/api/articles?limit=8", { cache: "no-store" });
        const data = await response.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        if (!cancelled) { setTrends(list); setTrendStatus(list.length ? "Public AI trend signals" : "No trend signals available right now."); }
      } catch { if (!cancelled) setTrendStatus("Trend signals are temporarily unavailable."); }
    })();
    return () => { cancelled = true; };
  }, []);

  const article = articles[index];
  const nextArticle = () => { setIndex((current) => articles.length ? (current + 1) % articles.length : 0); setComment(""); };
  const submitComment = () => { if (comment.trim()) { setComments((items) => [...items, comment.trim()]); setComment(""); } };

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-neutral-300/80 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3"><span className="font-serif text-2xl font-semibold tracking-[-0.04em]">POSTCRAFT</span><span className="hidden border-l border-neutral-300 pl-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">AI editorial automation</span></Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Main navigation">{[["Home","/"],["Write","/create"],["Auto-post","/auto-post"],["Article Review","/auto-post1"],["Auto-publish","/auto-publish"],["CommentCraft","/commentcraft/import"],["Workspace","/workspace"],["Billing","/billing"]].map(([label, href]) => <Link key={href} href={href} className={label === "Article Review" ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}>{label}</Link>)}</nav>
        </header>

        <section className="border-b border-neutral-300/80 py-12 lg:py-16"><p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">AI article intelligence</p><h1 className="max-w-3xl font-serif text-5xl leading-[0.95] tracking-[-0.055em] sm:text-7xl">Read what matters.<br />Go deeper than the headline.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600">PostCraft reviews available AI and technology stories, scores them for evidence, substance, and discussion value, then presents one article at a time for thoughtful reading and conversation.</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={() => void loadArticles()} disabled={loading} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{loading ? "Reviewing articles…" : "Refresh article pool"}</button>{article && <button onClick={nextArticle} className="rounded-full border border-neutral-400 px-5 py-3 text-sm font-medium">Next article →</button>}</div></section>

        {error && <div className="border-b border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>}
        {loading && <div className="py-16 text-sm text-neutral-500">Connecting to the AI news discovery pipeline and reviewing candidate stories…</div>}
        {!loading && article && <section className="grid gap-10 border-b border-neutral-300/80 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16"><article><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800">Quality score {article.qualityScore}/100</span><span className="rounded-full bg-neutral-200 px-3 py-1.5 text-xs text-neutral-600">Article {index + 1} of {articles.length}</span></div><h2 className="mt-6 max-w-3xl font-serif text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">{article.title}</h2><p className="mt-4 text-sm text-neutral-500">{article.source || "Source unavailable"}{article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleDateString()}` : ""}</p><p className="mt-8 text-lg leading-8 text-neutral-700">{article.description}</p>{article.whyItMatters && <div className="mt-8 border-l-2 border-neutral-900 pl-4"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Why this deserves attention</p><p className="mt-2 text-base leading-7">{article.whyItMatters}</p></div>}<a href={article.url} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white">Read the full article ↗</a></article><aside className="space-y-8"><div className="rounded-2xl border border-neutral-300 bg-white/60 p-6"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">How the score was formed</p><ul className="mt-4 space-y-3 text-sm leading-6">{(article.qualityReasons || []).map((reason) => <li key={reason} className="flex gap-2"><span>✓</span><span>{reason}</span></li>)}</ul><p className="mt-5 text-xs leading-5 text-neutral-500">This is an editorial aid, not a claim that the article is objectively true. Always verify important claims in the original source.</p></div><div className="rounded-2xl border border-neutral-300 bg-white/60 p-6"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Comment on this article</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="What did you find interesting, unclear, or worth discussing?" className="mt-4 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-900" /><button onClick={submitComment} disabled={!comment.trim()} className="mt-3 rounded-full border border-neutral-400 px-4 py-2 text-xs font-medium disabled:opacity-40">Add comment</button>{comments.length > 0 && <div className="mt-5 space-y-3">{comments.map((item, commentIndex) => <div key={`${item}-${commentIndex}`} className="rounded-xl bg-neutral-100 px-3 py-3 text-sm">{item}</div>)}</div>}</div></aside></section>}

        <section className="py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Social trend signals</p><h2 className="mt-2 font-serif text-3xl tracking-[-0.035em]">What people are discussing around AI</h2><p className="mt-2 text-sm text-neutral-500">{trendStatus}</p></div><span className="rounded-full bg-neutral-200 px-3 py-1.5 text-xs text-neutral-600">YouTube / Instagram discovery where available</span></div><div className="mt-6 grid gap-4 md:grid-cols-2">{trends.slice(0, 6).map((trend, trendIndex) => <div key={`${trend.title || trend.name}-${trendIndex}`} className="rounded-2xl border border-neutral-300 bg-white/50 p-5"><div className="flex items-center justify-between gap-3"><span className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{trend.platform || "AI trend"}</span>{trend.url && <a href={trend.url} target="_blank" rel="noreferrer" className="text-xs underline">Open ↗</a>}</div><h3 className="mt-3 font-serif text-xl leading-tight">{trend.title || trend.name || "Untitled trend"}</h3>{trend.description && <p className="mt-2 text-sm leading-6 text-neutral-600">{trend.description}</p>}</div>)}</div><p className="mt-6 text-xs leading-5 text-neutral-500">Instagram and YouTube do not expose a universal public feed of every trending post through one unrestricted API. This page uses available public trend data and can be extended with authenticated platform integrations or an approved social-data provider.</p></section>
      </div>
    </main>
  );
}
