"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CONTENT_INTERESTS } from "@/lib/content-interests";

export default function InterestsPage() {
  const router = useRouter();
  const [nextPath] = useState(() => {
    if (typeof window === "undefined") return "/";
    const value = new URLSearchParams(window.location.search).get("next");
    return value?.startsWith("/") ? value : "/";
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/preferences/interests", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Could not load your interests.");
        if (!active) return;
        setSelected(Array.isArray(data?.interests) ? data.interests : []);
        const setup = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("setup") === "1";
        if (data?.completed && !setup) router.replace(nextPath);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load your interests.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [nextPath, router]);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 5
          ? [...current, id]
          : current,
    );
  }

  async function save() {
    if (!selected.length) {
      setError("Choose at least one area of interest.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/preferences/interests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interests: selected }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not save your interests.");
      router.replace(nextPath);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your interests.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171717]">
      <div className="mx-auto max-w-5xl px-5 py-12 sm:px-8 sm:py-20">
        <div className="max-w-3xl">
          <Link href="/" className="font-serif text-2xl font-semibold tracking-[-0.04em]">POSTCRAFT</Link>
          <p className="mt-12 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Personalize your feed</p>
          <h1 className="mt-3 font-serif text-5xl leading-[0.95] tracking-[-0.055em] sm:text-6xl">
            What do you want to know about?
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600">
            Choose up to five areas. PostCraft will use these interests to discover relevant professional stories and will skip weak, promotional or poorly sourced material.
          </p>
        </div>

        {loading ? (
          <div className="py-16 text-sm text-neutral-500">Loading your preferences…</div>
        ) : (
          <>
            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {CONTENT_INTERESTS.map((interest) => {
                const active = selected.includes(interest.id);
                return (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggle(interest.id)}
                    className={`rounded-2xl border p-5 text-left transition ${active ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white/60 hover:border-neutral-600"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="font-medium">{interest.id}</span>
                      <span className={`text-xs ${active ? "text-white/70" : "text-neutral-400"}`}>{active ? "Selected" : "Select"}</span>
                    </div>
                    <p className={`mt-2 text-sm leading-6 ${active ? "text-white/70" : "text-neutral-500"}`}>{interest.description}</p>
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving || !selected.length}
                className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save interests →"}
              </button>
              <span className="text-xs text-neutral-500">{selected.length}/5 selected</span>
            </div>

            {error && <p className="mt-5 text-sm text-red-700">{error}</p>}

            <p className="mt-10 max-w-2xl text-xs leading-5 text-neutral-500">
              You can change these later from your preferences. Selection is required before PostCraft starts personalized content discovery.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
