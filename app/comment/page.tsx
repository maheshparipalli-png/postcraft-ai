"use client";

import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import CommentCard from "./components/CommentCard";
import CommentControls from "./components/CommentControls";
import CommentInput from "./components/CommentInput";
import { generateComments, refineComment, summarizeSource } from "./lib/api";
import { addHistory, getFavorites, getHistory, removeFavorite, saveFavorite } from "./lib/storage";
import type { Attachment, Comment, Depth, HistoryItem, Platform, Position, Style } from "./lib/types";


function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Unable to read file."));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
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
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const [refining, setRefining] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [view, setView] = useState<"generate" | "favorites" | "history">("generate");
  const [favorites, setFavorites] = useState<Comment[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useEffect(() => {
    setFavorites(Object.values(getFavorites()).reverse());
    setHistory(getHistory());
  }, []);

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
    setSummary("");
    if (!post.trim() && !url.trim() && !attachment) {
      setError("Add a post, URL, image, or file before generating comments.");
      return;
    }
    setView("generate");
    setLoading(true);
    setComments([]);

    try {
      const generated = await generateComments({ post, url, attachment, platform, position, styles: selectedStyles, depth });
      setComments(generated);
      if (!generated.length) {
        setError("The AI service returned no comments. Please try again.");
        return;
      }
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        post: post.trim(),
        url: url.trim(),
        platform,
        position,
        comments: generated,
      };
      addHistory(item);
      setHistory(getHistory());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function summarize() {
    setError("");
    if (!post.trim() && !url.trim() && !attachment) {
      setError("Add a post, URL, image, or file before summarizing.");
      return;
    }
    setSummaryLoading(true);
    try {
      const result = await summarizeSource({ post, url, attachment, platform, position, styles: selectedStyles, depth });
      setSummary(result || "No summary was returned.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to summarize the source.");
    } finally {
      setSummaryLoading(false);
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
    if (next) saveFavorite({ ...comment, is_favorite: true });
    else removeFavorite(comment.id);
    setFavorites(Object.values(getFavorites()).reverse());
  }

  async function refine(comment: Comment, instruction: string) {
    setError("");
    setRefining(comment.id);
    try {
      const refined = await refineComment(comment, instruction, platform);
      if (!refined.comment_text) throw new Error("Refine returned no comment.");
      setComments(current => current.map(item => item.id === comment.id ? {
        ...item,
        comment_text: refined.comment_text || item.comment_text,
        quality_score: refined.quality_score ?? item.quality_score,
        why_it_works: refined.why_it_works ?? item.why_it_works,
      } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refine failed.");
    } finally {
      setRefining(null);
    }
  }

  function share(comment: Comment) {
    void (async () => {
      try {
        if ("share" in navigator) await navigator.share({ text: comment.comment_text });
        else await copyComment(comment);
      } catch {
        // User cancelled the native share sheet.
      }
    })();
  }

  async function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const image = Array.from(event.clipboardData.items).find(item => item.type.startsWith("image/"));
    if (!image) return;
    const file = image.getAsFile();
    if (!file) return;
    event.preventDefault();
    await chooseFile(new File([file], "pasted-image.png", { type: file.type }));
  }

  function loadHistoryItem(item: HistoryItem) {
    setPost(item.post);
    setUrl(item.url);
    setPlatform(item.platform);
    setPosition(item.position);
    setComments(item.comments);
    setView("generate");
    setError("");
  }

  const visibleComments = view === "favorites" ? favorites : comments;

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
          <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">Choose where you are commenting, take a position, set the voice and depth, then generate five distinct comments.</p>
        </section>

        <nav className="mb-8 flex gap-2 border-b border-neutral-200 pb-3">
          {(["generate", "favorites", "history"] as const).map(item => (
            <button key={item} type="button" onClick={() => setView(item)}
              className={view === item ? "rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white" : "rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-medium text-neutral-600"}>
              {item === "generate" ? "Generate" : item === "favorites" ? `Favorites (${favorites.length})` : `History (${history.length})`}
            </button>
          ))}
        </nav>

        {view === "history" ? (
          <section className="space-y-3">
            <SectionTitle eyebrow="Recent" title="Generation history" />
            {history.length === 0 ? <Empty text="Your recent generations will appear here." /> : history.map(item => (
              <button key={item.id} type="button" onClick={() => loadHistoryItem(item)}
                className="block w-full border border-neutral-200 bg-white p-5 text-left hover:border-neutral-900">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs font-semibold">{item.platform} · {item.position}</div>
                  <div className="text-[10px] text-neutral-400">{new Date(item.created_at).toLocaleString()}</div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-neutral-700">{item.post || item.url || "Attached source"}</p>
                <div className="mt-2 text-xs text-neutral-400">{item.comments.length} comments</div>
              </button>
            ))}
          </section>
        ) : view === "favorites" ? (
          <section className="space-y-4">
            <SectionTitle eyebrow="Saved" title="Favorite comments" />
            {favorites.length === 0 ? <Empty text="Save a comment and it will stay here in Guest Mode." /> : favorites.map(comment => (
              <CommentCard key={comment.id} comment={comment} copied={copied === comment.id} refining={refining === comment.id}
                onCopy={() => void copyComment(comment)} onFavorite={() => favorite(comment)}
                onRefine={instruction => void refine(comment, instruction)} onShare={() => share(comment)} />
            ))}
          </section>
        ) : (
          <>
            <CommentControls platform={platform} position={position} selectedStyles={selectedStyles} depth={depth}
              setPlatform={setPlatform} setPosition={setPosition} toggleStyle={toggleStyle} setDepth={setDepth} />

            <CommentInput
              post={post}
              url={url}
              showUrl={showUrl}
              attachment={attachment}
              inputRef={inputRef}
              loading={loading}
              summaryLoading={summaryLoading}
              summary={summary}
              onPostChange={setPost}
              onPaste={handlePaste}
              onToggleUrl={() => setShowUrl(v => !v)}
              onUrlChange={setUrl}
              onChooseFile={file => void chooseFile(file)}
              onRemoveAttachment={() => { setAttachment(null); if (inputRef.current) inputRef.current.value = ""; }}
              onSummarize={() => void summarize()}
              onGenerate={() => void generate()}
            />

            {error && <div className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

            {visibleComments.length > 0 && (
              <section className="mt-10">
                <div className="mb-4 flex items-end justify-between">
                  <div><div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">Generated</div><h2 className="mt-1 font-serif text-3xl">Your comments</h2></div>
                  <span className="text-xs text-neutral-500">{visibleComments.length} options</span>
                </div>
                <div className="space-y-4">
                  {visibleComments.map(comment => <CommentCard key={comment.id} comment={comment} copied={copied === comment.id} refining={refining === comment.id}
                    onCopy={() => void copyComment(comment)} onFavorite={() => favorite(comment)}
                    onRefine={instruction => void refine(comment, instruction)} onShare={() => share(comment)} />)}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

