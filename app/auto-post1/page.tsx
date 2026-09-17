"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

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

type Trend = { title?: string; name?: string; url?: string; platform?: string; description?: string };

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
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkedinPost, setLinkedinPost] = useState("");
  const [comment, setComment] = useState("");
  const [comments, setComments] = useState<string[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);

  const article = articles[index];

  const generateLinkedInPost = useCallback(async (selected: Article) => {
    setPostLoading(true);
    setLinkedinPost("");
    try {
      const prompt = `Create a thoughtful, human-sounding LinkedIn post based only on this article. Do not invent facts. Start with a strong non-clickbait hook, explain the key development, describe why it matters to professionals or businesses, add one useful reflection, and end with a natural discussion question. Keep it between 120 and 220 words. Do not include a title, quotation marks, or generic motivational language. Add 3 to 5 relevant hashtags at the end.\n\nArticle title: ${selected.title}\nSource: ${selected.source || "Unknown"}\nSummary: ${selected.description || ""}\nWhy it matters: ${selected.whyItMatters || ""}\nOriginal URL: ${selected.url}`;
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", prompt }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.text !== "string") throw new Error(data?.error || "Could not generate the LinkedIn post.");
      setLinkedinPost(data.text.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate the LinkedIn post.");
    } finally {
      setPostLoading(false);
    }
  }, []);

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError("");
    setLinkedinPost("");
    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "AI & Technology" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not load AI articles.");
      const ranked = (Array.isArray(data?.ideas) ? data.ideas : [])
        .map((item: Article) => ({ ...item, ...scoreArticle(item) }))
        .sort((a: Article, b: Article) => (b.qualityScore || 0) - (a.qualityScore || 0));
      if (!ranked.length) throw new Error("No usable AI articles were returned.");
      setArticles(ranked);
      setIndex(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load articles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadArticles(); }, [loadArticles]);
  useEffect(() => { if (article) void generateLinkedInPost(article); }, [article, generateLinkedInPost]);
  useEffect(() => {
    fetch("https://whatstrending.ai/api/articles?limit=8", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setTrends(Array.isArray(data?.data) ? data.data : []))
      .catch(() => setTrends([]));
  }, []);

  function nextArticle() {
    setIndex((current) => articles.length ? (current + 1) % articles.length : 0);
    setComment("");
  }

  function submitComment() {
    if (comment.trim()) {
      setComments((items) => [...items, comment.trim()]);
      setComment("");
    }
  }

  async function copyPost() {
    if (linkedinPost) await navigator.clipboard?.writeText(linkedinPost);
  }

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-neutral-300/80 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3"><span className="font-serif text-2xl font-semibold tracking-[-0.04em]">POSTCRAFT</span><span className="hidden border-l border-neutral-300 pl-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">AI editorial automation</span></Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Main navigation"><Link href="/">Home</Link><Link href="/create">Write</Link><Link href="/auto-post">Auto-post</Link><Link href="/auto-post1" className="font-medium">Article Review</Link><Link href="/auto-publish">Auto-publish</Link><Link href="/commentcraft/import">CommentCraft</Link><Link href="/workspace">Workspace</Link><Link href="/billing">Billing</Link></nav>
        </header>

        <section className="border-b border-neutral-300/80 py-12 lg:py-16"><p className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">AI article intelligence</p><h1 className="max-w-3xl font-serif text-5xl leading-[0.95] tracking-[-0.055em] sm:text-7xl">Read what matters.<br />Turn insight into a post.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600">Review AI and technology stories, understand their quality signals, and automatically create a LinkedIn-ready post from the selected article.</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={() => void loadArticles()} disabled={loading} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-50">{loading ? "Reviewing articles…" : "Refresh article pool"}</button>{article && <button onClick={nextArticle} className="rounded-full border border-neutral-400 px-5 py-3 text-sm font-medium">Next article →</button>}</div></section>

        {error && <div className="border-b border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">{error}</div>}
        {loading && <div className="py-16 text-sm text-neutral-500">Connecting to the AI news discovery pipeline…</div>}
        {!loading && article && <section className="grid gap-10 border-b border-neutral-300/80 py-10 lg:grid-cols-2 lg:gap-12">
          <article><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-800">Quality score {article.qualityScore}/100</span><span className="rounded-full bg-neutral-200 px-3 py-1.5 text-xs text-neutral-600">Article {index + 1} of {articles.length}</span></div><h2 className="mt-6 font-serif text-4xl leading-tight tracking-[-0.04em] sm:text-5xl">{article.title}</h2><p className="mt-4 text-sm text-neutral-500">{article.source || "Source unavailable"}{article.publishedAt ? ` · ${new Date(article.publishedAt).toLocaleDateString()}` : ""}</p><p className="mt-8 text-lg leading-8 text-neutral-700">{article.description}</p>{article.whyItMatters && <div className="mt-8 border-l-2 border-neutral-900 pl-4"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Why this deserves attention</p><p className="mt-2 text-base leading-7">{article.whyItMatters}</p></div>}<a href={article.url} target="_blank" rel="noreferrer" className="mt-8 inline-flex rounded-full bg-neutral-900 px-5 py-3 text-sm font-medium text-white">Read the full article ↗</a></article>

          <aside className="space-y-6"><div className="rounded-2xl border border-neutral-300 bg-white/70 p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Generated LinkedIn post</p><p className="mt-1 text-sm text-neutral-500">Created automatically from this article</p></div>{postLoading && <span className="text-xs text-neutral-500">Generating…</span>}</div><textarea value={linkedinPost} onChange={(event) => setLinkedinPost(event.target.value)} rows={13} placeholder="Your LinkedIn post will appear here…" className="mt-5 w-full resize-y rounded-xl border border-neutral-300 bg-white px-4 py-4 text-sm leading-7 outline-none focus:border-neutral-900" /><div className="mt-4 flex flex-wrap gap-3"><button onClick={() => article && void generateLinkedInPost(article)} disabled={postLoading} className="rounded-full border border-neutral-400 px-4 py-2 text-xs font-medium disabled:opacity-50">Regenerate post</button><button onClick={() => void copyPost()} disabled={!linkedinPost} className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-40">Copy post</button></div></div><div className="rounded-2xl border border-neutral-300 bg-white/60 p-6"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">How the score was formed</p><ul className="mt-4 space-y-3 text-sm leading-6">{(article.qualityReasons || []).map((reason) => <li key={reason} className="flex gap-2"><span>✓</span><span>{reason}</span></li>)}</ul><p className="mt-5 text-xs leading-5 text-neutral-500">This score is an editorial aid, not proof that the article is true. Verify important claims in the original source.</p></div><div className="rounded-2xl border border-neutral-300 bg-white/60 p-6"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Comment on this article</p><textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={3} placeholder="What is worth discussing?" className="mt-4 w-full resize-y rounded-xl border border-neutral-300 bg-white px-3 py-3 text-sm outline-none focus:border-neutral-900" /><button onClick={submitComment} disabled={!comment.trim()} className="mt-3 rounded-full border border-neutral-400 px-4 py-2 text-xs font-medium disabled:opacity-40">Add comment</button>{comments.length > 0 && <div className="mt-5 space-y-3">{comments.map((item, commentIndex) => <div key={`${item}-${commentIndex}`} className="rounded-xl bg-neutral-100 px-3 py-3 text-sm">{item}</div>)}</div>}</div></aside>
        </section>}

        <section className="py-10"><p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Social trend signals</p><h2 className="mt-2 font-serif text-3xl tracking-[-0.035em]">What people are discussing around AI</h2><div className="mt-6 grid gap-4 md:grid-cols-2">{trends.slice(0, 6).map((trend, trendIndex) => <div key={`${trend.title || trend.name}-${trendIndex}`} className="rounded-2xl border border-neutral-300 bg-white/50 p-5"><div className="flex items-center justify-between gap-3"><span className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{trend.platform || "AI trend"}</span>{trend.url && <a href={trend.url} target="_blank" rel="noreferrer" className="text-xs underline">Open ↗</a>}</div><h3 className="mt-3 font-serif text-xl leading-tight">{trend.title || trend.name || "Untitled trend"}</h3>{trend.description && <p className="mt-2 text-sm leading-6 text-neutral-600">{trend.description}</p>}</div>)}</div></section>
      </div>
    </main>
  );
}
