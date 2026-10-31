"use client";

import { useLayoutEffect, useRef } from "react";
import type { ClipboardEvent, RefObject } from "react";
import type { Attachment } from "../lib/types";

type Props = {
  post: string; url: string; showUrl: boolean; attachment: Attachment | null;
  inputRef: RefObject<HTMLInputElement | null>;
  loading: boolean; summaryLoading: boolean; summary: string;
  onPostChange: (value: string) => void; onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onPasteImage: () => void; onReset: () => void; onToggleUrl: () => void; onUrlChange: (value: string) => void; onChooseFile: (file: File) => void;
  onRemoveAttachment: () => void; onSummarize: () => void; onGenerate: () => void;
};

export default function CommentInput({
  post,
  url,
  showUrl,
  attachment,
  inputRef,
  loading,
  summaryLoading,
  summary,
  onPostChange,
  onPaste,
  onPasteImage,
  onReset,
  onToggleUrl,
  onUrlChange,
  onChooseFile,
  onRemoveAttachment,
  onSummarize,
  onGenerate,
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 72)}px`;
  }, [post]);

  function resizeTextarea() {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.max(textarea.scrollHeight, 72)}px`;
  }

  return <section className="border border-neutral-200 bg-white p-5 sm:p-6">
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">Start here</div>
        <h2 className="mt-1 font-serif text-2xl tracking-[-.03em]">What do you want to respond to?</h2>
      </div>
      <span className="hidden text-xs text-neutral-400 sm:block">Paste text or an image</span>
    </div>

    <div className="border border-neutral-200 bg-[#f7f6f2] p-3 transition focus-within:border-neutral-900 focus-within:ring-1 focus-within:ring-neutral-900">
      {attachment?.type.startsWith("image/") && (
        <div className="relative mb-3 overflow-hidden border border-neutral-200 bg-white">
          <img
            src={attachment.data}
            alt={attachment.name || "Pasted image"}
            className="max-h-64 w-full object-contain"
          />
          <button
            type="button"
            onClick={onRemoveAttachment}
            className="absolute right-2 top-2 rounded-full border border-neutral-300 bg-white/95 px-3 py-1.5 text-xs font-semibold shadow-sm hover:border-neutral-900"
          >
            Remove image
          </button>
        </div>
      )}
      <textarea ref={textareaRef} value={post} onChange={e => { onPostChange(e.target.value); resizeTextarea(); }} onInput={resizeTextarea} onPaste={onPaste} rows={2}
        className="w-full resize-none border-0 bg-transparent p-1 text-sm leading-7 outline-none"
        placeholder="Paste the post here… You can also paste a screenshot directly." />
    </div>

    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400">
      <span>A new pasted post becomes the new source and resets the previous source settings.</span>
      <span className="font-medium text-neutral-500">Paste an image with Ctrl+V, or use “Paste image”.</span>
    </div>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={onPasteImage}
        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900">
        Paste image
      </button>
      <button type="button" onClick={onReset}
        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-600 hover:border-neutral-900 hover:text-neutral-950">
        Reset
      </button>
      <button type="button" onClick={onToggleUrl} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900">{showUrl ? "Hide URL" : "Add URL"}</button>
      <button type="button" onClick={() => inputRef.current?.click()} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900">Attach image / PDF / TXT</button>
      <button type="button" onClick={onSummarize} disabled={summaryLoading} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900 disabled:opacity-50">{summaryLoading ? "Summarizing…" : "Summarize"}</button>
      <input ref={inputRef} hidden type="file" accept="image/*,.pdf,.txt" onChange={e => { const file = e.target.files?.[0]; if (file) onChooseFile(file); }} />
    </div>

    {showUrl && <input value={url} onChange={e => onUrlChange(e.target.value)} type="url"
      className="mt-3 w-full border border-neutral-200 bg-[#f7f6f2] px-4 py-3 text-sm outline-none focus:border-neutral-900"
      placeholder="Paste the post URL…" />}

    {attachment && !attachment.type.startsWith("image/") && <div className="mt-3 flex items-center justify-between gap-4 border border-neutral-200 bg-[#f7f6f2] px-4 py-3 text-xs">
      <span className="truncate">{attachment.name}</span>
      <button type="button" onClick={onRemoveAttachment} className="shrink-0 font-semibold text-neutral-500 hover:text-black">Remove</button>
    </div>}

    {summary && <div className="mt-4 border-l-2 border-neutral-900 bg-[#f7f6f2] px-4 py-4 text-sm leading-6">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-neutral-500">Summary</div>{summary}
    </div>}

    <div className="mt-5 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-neutral-500">Up to 10 MB · 5 comments generated</span>
      <button type="button" onClick={onGenerate} disabled={loading}
        className="w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-40 sm:w-auto">
        {loading ? "Generating 5 perspectives…" : "Generate Comments →"}
      </button>
    </div>
    {loading && <div className="mt-4 border-t border-neutral-100 pt-4 text-xs text-neutral-500">Understanding the source → finding distinct angles → writing comments</div>}
  </section>;
}
