"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Card = {
  id: string;
  template: string;
  background: string;
  name: string;
  handle: string;
  headline: string;
  body: string;
  closing: string;
  stat: string;
  stat_label: string;
  source: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export default function SavedPostcardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/postcard/cards", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Could not load your saved PostCards.");
        setCards(data.cards || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load your saved PostCards."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-neutral-900">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6">
          <div>
            <Link href="/postcard" className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCARD</Link>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">Saved visuals</div>
          </div>
          <nav className="flex items-center gap-5 text-sm text-neutral-500">
            <Link href="/postcard" className="hover:text-neutral-900">Create</Link>
            <Link href="/workspace" className="hover:text-neutral-900">Workspace</Link>
          </nav>
        </header>

        <section className="border-b border-neutral-300/80 py-14 sm:py-18">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">My PostCards</div>
          <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[.98] tracking-[-0.045em] sm:text-7xl">Your visuals,<br />kept together.</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600">Open a saved card, copy its link, or return to the visual studio to create another.</p>
        </section>

        {error && <div className="border-b border-red-300 py-5 text-sm text-red-700">{error}</div>}

        <section className="py-10 sm:py-14">
          {loading ? (
            <div className="border-y border-neutral-300/80 py-12 text-sm text-neutral-500">Loading your PostCards…</div>
          ) : cards.length === 0 ? (
            <div className="border-y border-neutral-300/80 py-16">
              <div className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">Nothing saved yet</div>
              <h2 className="mt-3 font-serif text-3xl">Create your first PostCard.</h2>
              <Link href="/postcard" className="mt-7 inline-block border-b border-neutral-900 pb-1 text-sm font-medium">Open PostCard →</Link>
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((card) => (
                <article key={card.id} className="overflow-hidden border border-neutral-300 bg-white">
                  <div className={`aspect-square ${card.background === "dark" ? "bg-[#151515] text-white" : "bg-[#f4f1e9]"} flex items-center p-8`}>
                    <div>
                      {card.template === "stat" ? (
                        <>
                          <div className="text-6xl font-bold tracking-tight">{card.stat || "—"}</div>
                          <div className="mt-4 text-lg leading-7">{card.stat_label}</div>
                        </>
                      ) : (
                        <>
                          <div className="text-2xl font-semibold leading-tight">{card.headline || "Untitled PostCard"}</div>
                          <div className="mt-4 text-sm leading-6 opacity-70">{card.body}</div>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">{card.template} · {formatDate(card.created_at)}</div>
                    <h2 className="mt-2 line-clamp-2 font-serif text-xl">{card.headline || card.stat || "Untitled PostCard"}</h2>
                    <div className="mt-5 flex items-center gap-5 text-xs">
                      <Link href={`/postcard/${card.id}`} className="border-b border-neutral-900 pb-1 font-medium">Open</Link>
                      <button type="button" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/postcard/${card.id}`)} className="border-b border-neutral-400 pb-1 text-neutral-600">Copy link</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
