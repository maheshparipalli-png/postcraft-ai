"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Source={id:string;url:string;label:string;active:boolean;last_checked_at?:string|null;last_error?:string|null};
type Post={id:string;source_url:string|null;author_name:string|null;post_text:string;status:string;created_at:string};

export default function CommentCraftDashboard(){
 const [sources,setSources]=useState<Source[]>([]);
 const [posts,setPosts]=useState<Post[]>([]);
 const [url,setUrl]=useState("");
 const [label,setLabel]=useState("");
 const [loading,setLoading]=useState(true);
 const [checking,setChecking]=useState(false);
 const [message,setMessage]=useState("");

 async function load(){
  setLoading(true);
  try{
   const [s,p]=await Promise.all([fetch("/api/commentcraft/sources",{cache:"no-store"}),fetch("/api/commentcraft/posts",{cache:"no-store"})]);
   const sd=await s.json(); const pd=await p.json();
   if(!s.ok) throw new Error(sd.error||"Could not load sources.");
   if(!p.ok) throw new Error(pd.error||"Could not load review queue.");
   setSources(sd.sources||[]); setPosts(pd.posts||[]);
  }catch(e){setMessage(e instanceof Error?e.message:"Could not load CommentCraft.");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load()},[]);

 async function addSource(e:React.FormEvent){
  e.preventDefault(); if(!url.trim()) return;
  const r=await fetch("/api/commentcraft/sources",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,label})});
  const d=await r.json();
  if(!r.ok){setMessage(d.error||"Could not add source.");return;}
  setUrl("");setLabel("");setMessage("Source added.");await load();
 }
 async function check(){
  setChecking(true);setMessage("");
  try{
   const r=await fetch("/api/commentcraft/check",{method:"POST"});const d=await r.json();
   if(!r.ok) throw new Error(d.error||"Could not check sources.");
   const count=(d.results||[]).filter((x:{status:string})=>x.status==="new_draft").length;
   setMessage(count?count+" new comment draft(s) created.":"No new posts found.");
   await load();
  }catch(e){setMessage(e instanceof Error?e.message:"Could not check sources.");}
  finally{setChecking(false);}
 }
 async function remove(id:string){await fetch("/api/commentcraft/sources?id="+encodeURIComponent(id),{method:"DELETE"});await load();}

 return <main className="min-h-screen bg-[#f7f6f2] text-[#171717]"><div className="mx-auto max-w-6xl px-5 sm:px-8">
  <header className="flex items-end justify-between border-b border-neutral-300/80 py-6">
   <div><Link href="/" className="font-serif text-[22px] font-semibold">POSTCRAFT</Link><div className="text-[11px] uppercase tracking-[.2em] text-neutral-500">CommentCraft</div></div>
   <nav className="flex gap-4 text-xs"><Link href="/create" className="text-neutral-600 hover:text-black">Write</Link><Link href="/auto-post" className="text-neutral-600 hover:text-black">Auto-post</Link><Link href="/commentcraft/import" className="text-neutral-600 hover:text-black">Manual import</Link><Link href="/commentcraft/queue" className="text-neutral-600 hover:text-black">Review queue</Link></nav>
  </header>
  <section className="py-12"><div className="max-w-3xl"><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-neutral-400">Engage thoughtfully</div><h1 className="mt-3 font-serif text-5xl tracking-[-.045em]">CommentCraft</h1><p className="mt-4 text-base leading-7 text-neutral-600">Follow posts you care about, bring new conversations into PostCraft, and get a thoughtful first draft ready for your review.</p></div></section>
  <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
   <aside className="space-y-6">
    <form onSubmit={addSource} className="border border-neutral-200 bg-white p-6">
     <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">1 / Watch a source</div>
     <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="LinkedIn post URL" className="mt-5 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-black"/>
     <input value={label} onChange={e=>setLabel(e.target.value)} placeholder="Label (optional)" className="mt-4 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-black"/>
     <button className="mt-6 rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white">Add source →</button>
     <p className="mt-4 text-xs leading-5 text-neutral-500">For this MVP, add direct LinkedIn post URLs. Automatic discovery of new posts from arbitrary member profiles requires LinkedIn's restricted read permission.</p>
    </form>
    <div className="border border-neutral-200 bg-white p-6">
     <div className="flex items-center justify-between"><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">Watchlist</div><button onClick={check} disabled={checking||!sources.length} className="text-xs font-semibold underline underline-offset-4 disabled:opacity-40">{checking?"Checking...":"Check now"}</button></div>
     <div className="mt-5 space-y-4">{loading?<p className="text-sm text-neutral-500">Loading...</p>:sources.length===0?<p className="text-sm text-neutral-500">No sources yet.</p>:sources.map(s=><div key={s.id} className="border-t border-neutral-100 pt-4"><div className="flex justify-between gap-3"><div className="min-w-0"><div className="text-sm font-semibold">{s.label}</div><div className="mt-1 truncate text-xs text-neutral-500">{s.url}</div>{s.last_error&&<div className="mt-2 text-xs text-amber-700">{s.last_error}</div>}</div><button onClick={()=>remove(s.id)} className="text-xs text-neutral-400 hover:text-red-600">Remove</button></div></div>)}</div>
    </div>
   </aside>
   <section>
    <div className="flex items-end justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">2 / Review queue</div><h2 className="mt-2 font-serif text-3xl">Comments waiting for you</h2></div><span className="text-xs text-neutral-400">{posts.length} post{posts.length===1?"":"s"}</span></div>
    <div className="mt-6 space-y-4">{posts.length===0?<div className="border border-dashed border-neutral-300 p-8 text-sm text-neutral-500">No imported posts yet. Add a source and check it, or use Manual import for a post you already have.</div>:posts.map(p=><Link key={p.id} href={"/commentcraft/queue/"+p.id} className="block border border-neutral-200 bg-white p-6 transition hover:border-neutral-400"><div className="flex justify-between gap-4"><div><div className="text-sm font-semibold">{p.author_name||"LinkedIn post"}</div><div className="mt-1 text-[10px] uppercase tracking-[.14em] text-neutral-400">{p.status.replaceAll("_"," ")}</div></div><span className="text-xs text-neutral-400">{new Date(p.created_at).toLocaleDateString("en-IN")}</span></div><p className="mt-5 whitespace-pre-wrap text-sm leading-6 text-neutral-700">{p.post_text.slice(0,500)}{p.post_text.length>500?"…":""}</p><div className="mt-5 text-xs font-semibold underline underline-offset-4">Review comments →</div></Link>)}</div>
   </section>
  </div>
  {message&&<div className="my-8 border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600">{message}</div>}
 </div></main>
}
