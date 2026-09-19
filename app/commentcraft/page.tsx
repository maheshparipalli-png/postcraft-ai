"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Candidate = { title: string; url: string; snippet: string; discoveredAt?: string | null; score?: number | null };

export default function CommentCraftDashboard() {
  const router = useRouter();
  const [profileUrl, setProfileUrl] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState("");
  const [postText, setPostText] = useState("");

  async function discover() {
    setLoading(true); setMessage(""); setCandidates([]); setSelected(null);
    try {
      const response = await fetch("/api/commentcraft/discover-profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileUrl }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not find public posts.");
      setCandidates(data.candidates || []);
      if (!data.candidates?.length) setMessage("No publicly discoverable LinkedIn posts were found. Try again later or use Manual import.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not discover posts."); }
    finally { setLoading(false); }
  }

  async function generate() {
    if (!selected || !postText.trim()) return;
    setGenerating(true); setMessage("");
    try {
      const response = await fetch("/api/commentcraft/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceUrl: selected.url, postText: postText.trim(), summary: selected.title, preset: "thoughtful" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not generate comments.");
      router.push("/commentcraft/queue/" + data.post.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not generate comments."); }
    finally { setGenerating(false); }
  }

  return <main className="min-h-screen bg-[#f7f6f2] text-[#171717]"><div className="mx-auto max-w-6xl px-5 sm:px-8">
    <header className="flex items-end justify-between border-b border-neutral-300/80 py-6"><div><Link href="/" className="font-serif text-[22px] font-semibold">POSTCRAFT</Link><div className="text-[11px] uppercase tracking-[.2em] text-neutral-500">CommentCraft</div></div><nav className="flex gap-4 text-xs"><Link href="/create" className="text-neutral-600 hover:text-black">Write</Link><Link href="/auto-post" className="text-neutral-600 hover:text-black">Auto-post</Link><Link href="/commentcraft/import" className="text-neutral-600 hover:text-black">Manual import</Link><Link href="/commentcraft/queue" className="text-neutral-600 hover:text-black">Review queue</Link></nav></header>
    <section className="py-14"><div className="max-w-3xl"><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-neutral-400">Engage thoughtfully</div><h1 className="mt-3 font-serif text-5xl tracking-[-.045em]">Find a post worth responding to.</h1><p className="mt-5 max-w-2xl text-base leading-7 text-neutral-600">Enter someone's LinkedIn profile. PostCraft finds recent publicly discoverable posts, lets you choose one, and writes a thoughtful comment for you.</p></div></section>
    <section className="grid gap-8 lg:grid-cols-[420px_1fr]">
      <aside className="border border-neutral-200 bg-white p-7"><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">1 / Find a person</div><label className="mt-5 block text-xs font-medium uppercase tracking-[.14em] text-neutral-500">LinkedIn profile URL</label><input value={profileUrl} onChange={e=>setProfileUrl(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")void discover()}} placeholder="https://www.linkedin.com/in/warikoo/" className="mt-3 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-black"/><button onClick={discover} disabled={loading||!profileUrl.trim()} className="mt-7 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">{loading?"Finding posts…":"Find recent posts →"}</button><p className="mt-5 text-xs leading-5 text-neutral-500">Discovery uses public search indexing rather than directly scraping LinkedIn. Results are recent search matches, not a guaranteed live LinkedIn feed.</p>{message&&<div className="mt-5 border border-neutral-200 bg-[#f7f6f2] px-4 py-3 text-sm text-neutral-600">{message}</div>}</aside>
      <section><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">2 / Choose a post</div><h2 className="mt-2 font-serif text-3xl">Publicly discoverable posts</h2><div className="mt-6 space-y-4">{candidates.length===0?<div className="border border-dashed border-neutral-300 p-8 text-sm text-neutral-500">Enter a profile URL and find a post to continue.</div>:candidates.map((candidate,index)=><button key={candidate.url} onClick={()=>setSelected(candidate)} className={"block w-full text-left border p-6 transition "+(selected?.url===candidate.url?"border-neutral-900 bg-white":"border-neutral-200 bg-white/70 hover:border-neutral-400")}><div className="text-[10px] uppercase tracking-[.14em] text-neutral-400">{index===0?"Top search match":"Other result"}</div><h3 className="mt-2 font-medium leading-6">{candidate.title}</h3><p className="mt-3 text-sm leading-6 text-neutral-600">{candidate.snippet}</p><div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500"><span>{candidate.discoveredAt ? `Published/indexed: ${new Date(candidate.discoveredAt).toLocaleDateString()}` : "Date unavailable"}</span><span>{candidate.url}</span></div></button>)}</div></section>
    </section>
    {selected&&<section className="my-10 border border-neutral-200 bg-white p-7"><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">3 / Generate comment</div><div className="mt-3"><h2 className="font-serif text-3xl">Review the post content</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-600">Search indexing may only expose a snippet. Open the LinkedIn post, then paste the full text here when the snippet is incomplete. PostCraft will use exactly what you confirm.</p><a href={selected.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs underline underline-offset-4">Open LinkedIn post ↗</a><textarea value={postText} onChange={e=>setPostText(e.target.value)} rows={7} className="mt-5 w-full border border-neutral-200 bg-[#f7f6f2] p-4 text-sm leading-6 outline-none focus:border-neutral-900" placeholder="Paste the LinkedIn post text here..." /><div className="mt-5 flex items-center justify-between gap-4"><span className="text-xs text-neutral-500">{postText.trim().split(/\s+/).filter(Boolean).length} words available to PostCraft</span><button onClick={generate} disabled={generating||!postText.trim()} className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">{generating?"Generating…":"Generate comments →"}</button></div></div></section>}
    <div className="mb-12 text-xs text-neutral-500">Need the full post text? <Link href="/commentcraft/import" className="underline underline-offset-4">Use Manual import</Link> for content that isn't fully available through public search indexing.</div>
  </div></main>;
}
