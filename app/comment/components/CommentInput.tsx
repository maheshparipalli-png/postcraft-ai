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
  return <div className="border border-neutral-200 bg-white p-6">
    <Label text="Post" />
    <textarea value={props.post} onChange={e => props.onPostChange(e.target.value)} onPaste={props.onPaste} rows={10}
      className="w-full border border-neutral-200 bg-[#f7f6f2] p-4 text-sm leading-6 outline-none focus:border-neutral-900"
      placeholder="Paste the post you want to respond to… You can also paste an image directly here." />
    <div className="mt-2 text-[11px] text-neutral-400">Tip: paste a screenshot into this box to attach it automatically.</div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" onClick={props.onToggleUrl} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold">{props.showUrl ? "Hide URL" : "Add URL"}</button>
      <button type="button" onClick={() => props.inputRef.current?.click()} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold">Upload image / PDF / TXT</button>
      <button type="button" onClick={props.onSummarize} disabled={props.summaryLoading} className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold disabled:opacity-50">{props.summaryLoading ? "Summarizing…" : "Summarize"}</button>
      <input ref={props.inputRef} hidden type="file" accept="image/*,.pdf,.txt" onChange={e => { const file = e.target.files?.[0]; if (file) props.onChooseFile(file); }} />
    </div>
    {props.showUrl && <input value={props.url} onChange={e => props.onUrlChange(e.target.value)} type="url" className="mt-3 w-full border-b border-neutral-300 bg-transparent py-3 text-sm outline-none focus:border-neutral-900" placeholder="Paste a post URL…" />}
    {props.attachment && <div className="mt-3 flex items-center justify-between border border-neutral-200 bg-[#f7f6f2] px-4 py-3 text-xs"><span className="truncate">{props.attachment.name}</span><button type="button" onClick={props.onRemoveAttachment} className="ml-4 font-semibold text-neutral-500 hover:text-black">Remove</button></div>}
    {props.summary && <div className="mt-4 border-l-2 border-neutral-900 bg-[#f7f6f2] px-4 py-4 text-sm leading-6"><div className="mb-1 text-[10px] font-semibold uppercase tracking-[.14em] text-neutral-500">Summary</div>{props.summary}</div>}
    <div className="mt-5 flex items-center justify-between gap-4">
      <span className="text-xs text-neutral-500">Maximum upload size: 10 MB</span>
      <button type="button" onClick={props.onGenerate} disabled={props.loading} className="rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40">{props.loading ? "Generating 5 perspectives…" : "Generate Comments →"}</button>
    </div>
    {props.loading && <div className="mt-4 border-t border-neutral-100 pt-4 text-xs text-neutral-500">Understanding the source → finding distinct angles → writing comments</div>}
  </div>;
}

function Label({ text }: { text: string }) {
  return <div className="mb-4 text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">{text}</div>;
}
