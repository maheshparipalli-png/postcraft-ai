"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Platform = "LinkedIn" | "X" | "Instagram" | "Facebook" | "YouTube" | "Reddit" | "Threads" | "TikTok";
type Position = "Agree" | "Partially Agree" | "Disagree" | "Add a Different Perspective" | "Challenge the Assumption" | "Ask a Question";
type Depth = "Easy to Understand" | "Medium" | "High";
type Style = "Natural" | "Crunchy" | "Bold" | "Thought-Provoking" | "Witty" | "Storytelling" | "Rhyming" | "Satirical";

type Comment = {
  id: string;
  comment_text: string;
  quality_score: number;
  why_it_works: string | null;
  is_favorite: boolean;
};

type Attachment = { name: string; type: string; data: string };

const platforms: Platform[] = ["LinkedIn", "X", "Instagram", "Facebook", "YouTube", "Reddit", "Threads", "TikTok"];
const positions: Position[] = ["Agree", "Partially Agree", "Disagree", "Add a Different Perspective", "Challenge the Assumption", "Ask a Question"];
const styles: Style[] = ["Natural", "Crunchy", "Bold", "Thought-Provoking", "Witty", "Storytelling", "Rhyming", "Satirical"];
const depths: Depth[] = ["Easy to Understand", "Medium", "High"];
const quickRefines = ["Shorter", "More Human", "More Bold", "Add a Question"];

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read file."));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function id() {
  return crypto.randomUUID();
}

export default function CommentPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [platform, setPlatform] = useState<Platform>("LinkedIn");
  const [position, setPosition] = useState<Position>("Agree");
  const [selectedStyles, setSelectedStyles] = useState<Style[]>(["Natural"]);
  const [depth, setDepth] = useState<Depth>("Medium");
  const [post, setPost] = useState("");
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [refining, setRefining] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [whyOpen, setWhyOpen] = useState<Record<string, boolean>>({});
  const [refineOpen, setRefineOpen] = useState<Record<string, boolean>>({});
  const [customRefine, setCustomRefine] = useState<Record<string, string>>({});

  function toggleStyle(style: Style) {
    setSelectedStyles(current =>
      current.includes(style)
        ? current.length === 1 ? current : current.filter(item => item !== style)
        : [...current, style]
    );
  }

  async function chooseFile(file: File) {
    setError("");
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be 10 MB or less.");
      return;
    }
    if (!file.type.startsWith("image/") && file.type !== "application/pdf" && file.type !== "text/plain") {
      setError("Please upload an image, PDF, or TXT file.");
      return;
    }
    try {
      setAttachment({ name: file.name, type: file.type, data: await readFile(file) });
    } catch {
      setError("Unable to read the selected file.");
    }
  }

  async function generate() {
    setError("");
    if (!post.trim() && !url.trim() && !attachment) {
      setError("Add a post, URL, image, or file before generating comments.");
      return;
    }

    setLoading(true);
    setComments([]);

    try {
      const body = {
        action: "generate",
        post: post.trim(),
        content_url: url.trim(),
        image_base64: attachment?.type.startsWith("image/") ? attachment.data.replace(/^data:[^;]+;base64,/, "") : undefined,
        image_mime_type: attachment?.type.startsWith("image/") ? attachment.type : undefined,
        file_base64: attachment && !attachment.type.startsWith("image/") ? attachment.data.replace(/^data:[^;]+;base64,/, "") : undefined,
        file_mime_type: attachment && !attachment.type.startsWith("image/") ? attachment.type : undefined,
        file_name: attachment && !attachment.type.startsWith("image/") ? attachment.name : undefined,
        platform: platform.toLowerCase(),
        position,
        styles: selectedStyles,
        depth,
        keywords: [],
        count: 5,
      };

      const response = await fetch("/api/commentcraft-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 429) throw new Error("AI usage limit reached. Please try again later.");
        if (response.status === 503) throw new Error("The AI service is temporarily busy. Please try again.");
        throw new Error(data?.error || "Unable to generate comments right now.");
      }

      const generated = (data.comments ?? []).map((item: Partial<Comment>) => ({
        id: item.id || id(),
        comment_text: item.comment_text || "",
        quality_score: item.quality_score ?? 0,
        why_it_works: item.why_it_works ?? null,
        is_favorite: Boolean(item.is_favorite),
      })).filter((item: Comment) => item.comment_text);

      setComments(generated);
      if (!generated.length) setError("The AI service returned no comments. Please try again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function copyComment(comment: Comment) {
    try {
      await navigator.clipboard.writeText(comment.comment_text);
      setCopied(comment.id);
      window.setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Copy failed. Your browser may have blocked clipboard access.");
    }
  }

  function favorite(comment: Comment) {
    const next = !comment.is_favorite;
    setComments(current => current.map(item => item.id === comment.id ? { ...item, is_favorite: next } : item));
    try {
      const saved = JSON.parse(localStorage.getItem("comment-favorites") || "{}") as Record<string, Comment>;
      if (next) saved[comment.id] = { ...comment, is_favorite: true };
      else delete saved[comment.id];
      localStorage.setItem("comment-favorites", JSON.stringify(saved));
    } catch { /* local-only convenience; generation is unaffected */ }
  }

  async function refine(comment: Comment, instruction: string) {
    const clean = instruction.trim() || "Make this more natural";
    setError("");
    setRefining(comment.id);

    try {
      const response = await fetch("/api/commentcraft-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "refine",
          comment: comment.comment_text,
          instruction: clean,
          platform: platform.toLowerCase(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || "Refine failed.");
      }

      const refined = data.comment_text || data.comments?.[0]?.comment_text;
      if (!refined) {
        throw new Error("Refine returned no comment.");
      }

      setComments(current => current.map(item => item.id === comment.id ? {
        ...item,
        comment_text: refined,
        quality_score: data.quality_score ?? data.comments?.[0]?.quality_score ?? item.quality_score,
        why_it_works: data.why_it_works ?? data.comments?.[0]?.why_it_works ?? item.why_it_works,
      } : item));
      setRefineOpen(current => ({ ...current, [comment.id]: false }));
      setCustomRefine(current => ({ ...current, [comment.id]: "" }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setRefining(null);
    }
  }

  async function share(comment: Comment) {
    try {
      if ("share" in navigator) {
        await navigator.share({ text: comment.comment_text });
      } else {
        await copyComment(comment);
      }
    } catch { /* user cancelled */ }
  }

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-neutral-950">
      <div className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 lg:px-8">
        <header className="border-b border-neutral-300/80 py-8">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[.22em] text-neutral-500">Ninety6 AI</div>
              <h1 className="mt-1 font-serif text-3xl font-semibold tracking-[-.04em]">COMMENT</h1>
              <p className="mt-1 text-sm text-neutral-500">Make your point count.</p>
            </div>
            <div className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-neutral-500">Guest Mode</div>
          </div>
        </header>

        <section className="py-10">
          <h2 className="font-serif text-4xl tracking-[-.045em] sm:text-5xl">Turn posts into thoughtful comments.</h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">
            Choose where you are commenting, take a position, set the voice and depth, then generate five distinct comments.
          </p>
        </section>

        <section className="space-y-8">
          <div className="border border-neutral-200 bg-white p-6">
            <Label text="Where are you commenting?" />
            <Chips values={platforms} selected={platform} onSelect={setPlatform} />
          </div>

          <div className="border border-neutral-200 bg-white p-6">
            <Label text="Your position" />
            <Chips values={positions} selected={position} onSelect={setPosition} />
          </div>

          <div className="border border-neutral-200 bg-white p-6">
            <Label text="Comment style" />
            <div className="flex flex-wrap gap-2">
              {styles.map(style => (
                <button key={style} type="button" onClick={() => toggleStyle(style)}
                  className={selectedStyles.includes(style)
                    ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white"
                    : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-900"}>
                  {style}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-neutral-200 bg-white p-6">
            <Label text="Depth" />
            <Chips values={depths} selected={depth} onSelect={setDepth} />
          </div>

          <div className="border border-neutral-200 bg-white p-6">
            <Label text="Post" />
            <textarea value={post} onChange={e => setPost(e.target.value)} rows={10}
              className="w-full border border-neutral-200 bg-[#f7f6f2] p-4 text-sm leading-6 outline-none focus:border-neutral-900"
              placeholder="Paste the post you want to respond to..." />

            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={() => setShowUrl(v => !v)}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900">
                {showUrl ? "Hide URL" : "Add URL"}
              </button>
              <button type="button" onClick={() => inputRef.current?.click()}
                className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold">
                Upload image / PDF / TXT
              </button>
              <input ref={inputRef} hidden type="file" accept="image/*,.pdf,.txt"
                onChange={e => { const file = e.target.files?.[0]; if (file) void chooseFile(file); }} />
            </div>

            {showUrl && (
              <input value={url} onChange={e => setUrl(e.target.value)} type="url"
                className="mt-3 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-neutral-900"
                placeholder="Paste a post URL..." />
            )}

            {attachment && (
              <div className="mt-3 flex items-center justify-between border border-neutral-200 bg-[#f7f6f2] px-4 py-3 text-xs">
                <span className="truncate">{attachment.name}</span>
                <button type="button" onClick={() => { setAttachment(null); if (inputRef.current) inputRef.current.value = ""; }}
                  className="ml-4 font-semibold text-neutral-500 hover:text-black">Remove</button>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between gap-4">
              <span className="text-xs text-neutral-500">Maximum upload size: 10 MB</span>
              <button type="button" onClick={() => void generate()} disabled={loading}
                className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">
                {loading ? "Generating…" : "Generate Comments →"}
              </button>
            </div>
          </div>
        </section>

        {error && <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

        {comments.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">Generated</div>
                <h2 className="mt-1 font-serif text-3xl">Your comments</h2>
              </div>
              <span className="text-xs text-neutral-500">{comments.length} options</span>
            </div>

            <div className="space-y-4">
              {comments.map(comment => (
                <article key={comment.id} className="border border-neutral-200 bg-white p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-5">
                    <p className="whitespace-pre-wrap text-sm leading-7 text-neutral-800">{comment.comment_text}</p>
                    <span className="shrink-0 rounded-full bg-neutral-900 px-2.5 py-1 text-[10px] font-semibold text-white">{comment.quality_score}/100</span>
                  </div>

                  {whyOpen[comment.id] && (
                    <div className="mt-4 border-l-2 border-neutral-900 bg-[#f7f6f2] px-4 py-3 text-xs leading-5 text-neutral-600">
                      <strong className="text-neutral-900">Why this works:</strong> {comment.why_it_works || "It adds a distinct perspective while staying connected to the original post."}
                    </div>
                  )}

                  {refineOpen[comment.id] && (
                    <div className="mt-4 border border-neutral-200 bg-[#f7f6f2] p-4">
                      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-neutral-500">Quick refine</div>
                      <div className="flex flex-wrap gap-2">
                        {quickRefines.map(option => (
                          <button key={option} type="button" disabled={refining === comment.id}
                            onClick={() => void refine(comment, option)}
                            className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">
                            {option}
                          </button>
                        ))}
                      </div>
                      <div className="mt-3 flex gap-2">
                        <input value={customRefine[comment.id] || ""} onChange={e => setCustomRefine(v => ({ ...v, [comment.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") void refine(comment, customRefine[comment.id] || "Make this more natural"); }}
                          placeholder="Custom instruction..."
                          className="min-w-0 flex-1 border border-neutral-300 bg-white px-3 py-2 text-xs outline-none focus:border-neutral-900" />
                        <button type="button" disabled={refining === comment.id}
                          onClick={() => void refine(comment, customRefine[comment.id] || "Make this more natural")}
                          className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
                          {refining === comment.id ? "Working…" : "Apply"}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-neutral-100 pt-4">
                    <Action label={copied === comment.id ? "Copied!" : "Copy"} onClick={() => void copyComment(comment)} />
                    <Action label={comment.is_favorite ? "Saved" : "Favorite"} onClick={() => favorite(comment)} active={comment.is_favorite} />
                    <Action label={whyOpen[comment.id] ? "Hide why" : "Why this works"} onClick={() => setWhyOpen(v => ({ ...v, [comment.id]: !v[comment.id] }))} />
                    <Action label={refineOpen[comment.id] ? "Close refine" : "Refine"} onClick={() => setRefineOpen(v => ({ ...v, [comment.id]: !v[comment.id] }))} />
                    <Action label="Share" onClick={() => void share(comment)} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Label({ text }: { text: string }) {
  return <div className="mb-4 text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">{text}</div>;
}

function Chips<T extends string>({ values, selected, onSelect }: { values: T[]; selected: T; onSelect: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map(value => (
        <button key={value} type="button" onClick={() => onSelect(value)}
          className={selected === value
            ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white"
            : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-900"}>
          {value}
        </button>
      ))}
    </div>
  );
}

function Action({ label, onClick, active = false }: { label: string; onClick: () => void; active?: boolean }) {
  return <button type="button" onClick={onClick}
    className={active
      ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white"
      : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-900"}>
    {label}
  </button>;
}
