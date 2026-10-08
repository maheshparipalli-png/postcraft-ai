"use client";

type Props = {
  draft: string;
  refined: string;
  loading: boolean;
  onDraftChange: (value: string) => void;
  onRefine: () => void;
  onCopy: () => void;
};

export default function MyWordsRefiner({
  draft,
  refined,
  loading,
  onDraftChange,
  onRefine,
  onCopy,
}: Props) {
  return (
    <section className="mt-8 border border-neutral-200 bg-white p-6">
      <div className="mb-4">
        <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">
          Write in your own words
        </div>
        <h3 className="mt-1 font-serif text-2xl tracking-[-.03em]">
          You write it. AI refines it.
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
          Write your comment the way you naturally would. AI will refine the wording while keeping your meaning, point of view, and voice intact.
        </p>
      </div>

      <textarea
        value={draft}
        onChange={e => onDraftChange(e.target.value)}
        rows={6}
        className="w-full border border-neutral-200 bg-[#f7f6f2] p-4 text-sm leading-6 outline-none focus:border-neutral-900"
        placeholder="Write your comment in your own words..."
      />

      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-xs text-neutral-500">
          AI will keep your original idea and make it clearer and more natural.
        </span>
        <button
          type="button"
          onClick={onRefine}
          disabled={loading || !draft.trim()}
          className="shrink-0 rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {loading ? "Refining…" : "Refine with AI →"}
        </button>
      </div>

      {refined && (
        <div className="mt-6 border-t border-neutral-100 pt-5">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">
              Refined comment
            </div>
            <button
              type="button"
              onClick={onCopy}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold hover:border-neutral-900"
            >
              Copy
            </button>
          </div>
          <div className="whitespace-pre-wrap border border-neutral-200 bg-[#f7f6f2] p-4 text-sm leading-7 text-neutral-800">
            {refined}
          </div>
        </div>
      )}
    </section>
  );
}
