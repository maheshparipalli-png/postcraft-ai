"use client";

import { useState } from "react";
import type { Comment } from "../lib/types";

type Props = {
  comment: Comment;
  copied: boolean;
  refining: boolean;
  onCopy: () => void;
  onFavorite: () => void;
  onRefine: (instruction: string) => void;
  onShare: () => void;
};

const quickRefines = ["Shorter", "More Human", "More Bold", "Add a Question"];

export default function CommentCard({ comment, copied, refining, onCopy, onFavorite, onRefine, onShare }: Props) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [refineOpen, setRefineOpen] = useState(false);
  const [custom, setCustom] = useState("");

  return (
    <article className="border border-neutral-200 bg-white p-5 sm:p-6">
      <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">Comment</div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-neutral-800">{comment.comment_text}</p>

      {whyOpen && (
        <div className="mt-4 border-l-2 border-neutral-900 bg-[#f7f6f2] px-4 py-3 text-xs leading-5 text-neutral-600">
          <strong className="text-neutral-900">Why this works:</strong> {comment.why_it_works || "It adds a distinct perspective while staying connected to the original post."}
        </div>
      )}

      {refineOpen && (
        <div className="mt-4 border border-neutral-200 bg-[#f7f6f2] p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[.14em] text-neutral-500">Quick refine</div>
          <div className="flex flex-wrap gap-2">
            {quickRefines.map(option => (
              <button key={option} type="button" disabled={refining} onClick={() => onRefine(option)}
                className="rounded-full border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-50">{option}</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={custom} onChange={e => setCustom(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && custom.trim()) { onRefine(custom); setCustom(""); } }}
              placeholder="Custom instruction…"
              className="min-w-0 flex-1 border border-neutral-300 bg-white px-3 py-2 text-xs outline-none focus:border-neutral-900" />
            <button type="button" disabled={refining || !custom.trim()} onClick={() => { onRefine(custom); setCustom(""); }}
              className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">{refining ? "Working…" : "Apply"}</button>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-neutral-100 pt-4">
        <Action label={copied ? "Copied!" : "Copy"} onClick={onCopy} primary />
        <Action label={comment.is_favorite ? "Saved" : "Save"} onClick={onFavorite} active={comment.is_favorite} />
        <Action label={whyOpen ? "Hide why" : "Why this works"} onClick={() => setWhyOpen(v => !v)} />
        <Action label={refineOpen ? "Close refine" : "Refine"} onClick={() => setRefineOpen(v => !v)} />
        <Action label="Share" onClick={onShare} />
      </div>
    </article>
  );
}

function Action({ label, onClick, active = false, primary = false }: { label: string; onClick: () => void; active?: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick}
    className={primary
      ? "rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
      : active
        ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white"
        : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-900"}>
    {label}
  </button>;
}
