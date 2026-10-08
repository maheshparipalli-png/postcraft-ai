"use client";

import type { ClipboardEvent, RefObject } from "react";
import type { Attachment } from "../lib/types";

type Props = {
  post: string; url: string; showUrl: boolean; attachment: Attachment | null;
  inputRef: RefObject<HTMLInputElement | null>;
  loading: boolean; summaryLoading: boolean; summary: string;
  onPostChange: (value: string) => void; onPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onToggleUrl: () => void; onUrlChange: (value: string) => void; onChooseFile: (file: File) => void;
  onRemoveAttachment: () => void; onSummarize: () => void; onGenerate: () => void;
};

export default function CommentInput(props: Props) {
  return <section className="border border-neutral-200 bg-white p-5 sm:p-6">
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">Start here</div>
        <h2 className="mt-1 font-serif text-2xl tracking-[-.03em]">What do you want to respond to?</h2>
      </div>
      <span className="hidden text-xs text-neutral-400 sm:block">Paste text or an image</span>
    </div>

    <textarea value={props.post} onChange={e => props.onPostChange(e.target.value)} onPaste={props.onPaste} rows={9}
      className="w-full resize-y border border-neutral-200 bg-[#f7f6f2] p-4 text-sm leading-7 outline-none transition focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900"
      placeholder="Paste the post here… You can also paste a screenshot directly." />

    <div className="mt-2 text-[11px] text-neutral-400">A new pasted post becomes the new source and resets the previous source settings.</div>

    <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={props.onToggleUrl} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900">{props.showUrl ? "Hide URL" : "Add URL"}</button>
      <button type="button" onClick={() => props.inputRef.current?.click()} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900">Attach image / PDF / TXT</button>
      <button type="button" onClick={props.onSummarize} disabled={props.summaryLoading} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold hover:border-neutral-900 disabled:opacity-50">{props.summaryLoading ? "Summarizing…" : "Summarize"}</button>
      <input ref={props.inputRef} hidden type="file" accept="image/*,.pdf,.txt" onChange={e => { const file = e.target.files?.[0]; if (file) props.onChooseFile(file); }} />
    </div>

    {props.showUrl && <input value={props.url} onChange={e => props.onUrlChange(e.target.value)} type="url"
      className="mt-3 w-full border border-neutral-200 bg-[#f7f6f2] px-4 py-3 text-sm outline-none focus:border-neutral-900"
      placeholder="Paste the post URL…" />}

    {props.attachment && <div className="mt-3 flex items-center justify-between gap-4 border border-neutral-200 bg-[#f7f6f2] px-4 py-3 text-xs">
      <span className="truncate">{props.attachment.name}</span>
      <button type="button" onClick={props.onRemoveAttachment} className="shrink-0 font-semibold text-neutral-500 hover:text-black">Remove</button>
    </div>}

    {props.summary && <div className="mt-4 border-l-2 border-neutral-900 bg-[#f7f6f2] px-4 py-4 text-sm leading-6">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-neutral-500">Summary</div>{props.summary}
    </div>}

    <div className="mt-5 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs text-neutral-500">Up to 10 MB · 5 comments generated</span>
      <button type="button" onClick={props.onGenerate} disabled={props.loading}
        className="w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:opacity-40 sm:w-auto">
        {props.loading ? "Generating 5 perspectives…" : "Generate Comments →"}
      </button>
    </div>
    {props.loading && <div className="mt-4 border-t border-neutral-100 pt-4 text-xs text-neutral-500">Understanding the source → finding distinct angles → writing comments</div>}
  </section>;
}
