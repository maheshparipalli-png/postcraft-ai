"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Post = {
  id: string;
  title: string | null;
  content: string;
  topic: string | null;
  source_url: string | null;
  angle: string | null;
  tone: string | null;
  status: string | null;
  created_at: string;
  updated_at: string | null;
};

type Filter = "all" | "draft" | "published";

function formatDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function preview(content: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > 240 ? `${clean.slice(0, 240).trim()}…` : clean;
}

export default function WorkspacePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPosts() {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Please sign in to view your workspace.");

        const { data, error: postsError } = await supabase
          .from("posts")
          .select("id, title, content, topic, source_url, angle, tone, status, created_at, updated_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (postsError) throw postsError;
        if (active) setPosts((data ?? []) as Post[]);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Could not load your saved posts.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPosts();
    return () => { active = false; };
  }, []);

  const filteredPosts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return posts.filter((post) => {
      const status = post.status || "draft";
      const matchesFilter = filter === "all" || status === filter;
      const searchable = [post.title, post.content, post.topic, post.angle, post.tone]
        .filter(Boolean).join(" ").toLowerCase();
      return matchesFilter && (!query || searchable.includes(query));
    });
  }, [posts, filter, search]);

  async function deletePost(id: string) {
    if (!window.confirm("Delete this saved post? This action cannot be undone.")) return;
    setDeletingId(id);
    setError("");
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase.from("posts").delete().eq("id", id);
      if (deleteError) throw deleteError;
      setPosts((current) => current.filter((post) => post.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this post.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7">
          <div>
            <Link href="/" className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCRAFT</Link>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">Editorial workspace</div>
          </div>
          <nav className="flex items-center gap-4 text-xs" aria-label="Workspace navigation">
            <Link href="/" className="text-neutral-500 transition hover:text-neutral-900">Writing studio</Link>
            <span className="font-medium text-neutral-900">Workspace</span>
          </nav>
        </header>

        <section className="border-b border-neutral-300/80 py-14 sm:py-20">
          <div className="max-w-4xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Your library</div>
            <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.045em] sm:text-7xl">Your ideas,<br />kept together.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">Revisit saved drafts, find an unfinished thought, and continue shaping something worth saying.</p>
          </div>
        </section>

        <section className="border-b border-neutral-300/80 py-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter saved posts">
              {(["all", "draft", "published"] as Filter[]).map((item) => {
                const selected = filter === item;
                const label = item === "all" ? "All posts" : item.charAt(0).toUpperCase() + item.slice(1);
                return <button key={item} type="button" onClick={() => setFilter(item)} className={`border px-4 py-2 text-xs transition ${selected ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-900 hover:text-neutral-900"}`}>{label}</button>;
              })}
            </div>
            <label className="block w-full lg:max-w-sm"><span className="sr-only">Search saved posts</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search your posts..." className="w-full border-b border-neutral-400 bg-transparent px-0 py-3 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-900" /></label>
          </div>
        </section>

        {error && <div className="border-b border-red-300 py-5 text-sm text-red-700">{error}</div>}

        <section className="py-10 sm:py-14">
          {loading ? <div className="border-y border-neutral-300/80 py-12 text-sm text-neutral-500">Loading your workspace…</div> : filteredPosts.length === 0 ? (
            <div className="border-y border-neutral-300/80 py-16">
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Nothing here yet</div>
              <h2 className="mt-3 max-w-xl font-serif text-3xl leading-tight">{posts.length === 0 ? "Your saved posts will appear here." : "No posts match this search or filter."}</h2>
              <p className="mt-4 max-w-lg text-sm leading-6 text-neutral-500">{posts.length === 0 ? "Start in the writing studio, create a post, and save it to build your editorial library." : "Try another search term or switch to a different status filter."}</p>
              {posts.length === 0 && <Link href="/" className="mt-7 inline-block border-b border-neutral-900 pb-1 text-sm font-medium">Find something worth saying →</Link>}
            </div>
          ) : (
            <div className="divide-y divide-neutral-300/80 border-y border-neutral-300/80">
              {filteredPosts.map((post, index) => <article key={post.id} className="group py-8 sm:py-10"><div className="grid gap-6 lg:grid-cols-[72px_1fr_auto] lg:gap-8"><div className="font-serif text-sm text-neutral-400">{String(index + 1).padStart(2, "0")}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] uppercase tracking-[0.15em] text-neutral-500"><span>{post.topic || "Untitled topic"}</span><span>{post.status === "published" ? "Published" : "Draft"}</span><span>{formatDate(post.created_at)}</span></div><h2 className="mt-3 max-w-3xl font-serif text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">{post.title || "Untitled post"}</h2><p className="mt-4 max-w-3xl text-sm leading-6 text-neutral-600">{preview(post.content)}</p><div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">{post.angle && <span className="text-neutral-500">Angle: {post.angle}</span>}{post.tone && <span className="text-neutral-500">Tone: {post.tone}</span>}{post.source_url && <a href={post.source_url} target="_blank" rel="noreferrer" className="text-neutral-500 underline underline-offset-4 hover:text-neutral-900">Read source</a>}</div></div><div className="flex items-start gap-4 lg:justify-end"><Link href={`/?postId=${encodeURIComponent(post.id)}`} className="border-b border-neutral-900 pb-1 text-xs font-medium hover:pr-1">Open</Link><button type="button" onClick={() => deletePost(post.id)} disabled={deletingId === post.id} className="border-b border-red-700 pb-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:opacity-50">{deletingId === post.id ? "Deleting…" : "Delete"}</button></div></div></article>)}
            </div>
          )}
        </section>

        <footer className="flex items-center justify-between border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400"><span>PostCraft AI</span><span>{posts.length} saved posts</span></footer>
      </div>
    </main>
  );
}
