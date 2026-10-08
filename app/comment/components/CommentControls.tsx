"use client";

import { useState } from "react";
import type { Depth, Platform, Position, Style } from "../lib/types";
import { depths, platforms, positions, styles } from "../lib/types";

export default function CommentControls({ platform, position, selectedStyles, depth, setPlatform, setPosition, toggleStyle, setDepth }: {
  platform: Platform; position: Position; selectedStyles: Style[]; depth: Depth;
  setPlatform: (value: Platform) => void; setPosition: (value: Position) => void;
  toggleStyle: (value: Style) => void; setDepth: (value: Depth) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="mb-5 border border-neutral-200 bg-white">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">Customize</div>
          <div className="mt-1 text-sm font-semibold text-neutral-900">
            {platform} · {position} · {selectedStyles.join(", ")} · {depth}
          </div>
        </div>
        <span className="shrink-0 text-xs font-semibold text-neutral-500">{open ? "Hide" : "Change"} settings</span>
      </button>

      {open && (
        <div className="grid gap-5 border-t border-neutral-100 p-5 sm:p-6 lg:grid-cols-2">
          <Panel label="Where are you commenting?"><Chips values={platforms} selected={platform} onSelect={setPlatform} /></Panel>
          <Panel label="Your position"><Chips values={positions} selected={position} onSelect={setPosition} /></Panel>
          <Panel label="Comment style">
            <div className="flex flex-wrap gap-2">
              {styles.map(style => <button key={style} type="button" onClick={() => toggleStyle(style)}
                className={selectedStyles.includes(style) ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white" : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-900"}>
                {style}
              </button>)}
            </div>
          </Panel>
          <Panel label="Depth"><Chips values={depths} selected={depth} onSelect={setDepth} /></Panel>
        </div>
      )}
    </section>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="mb-3 text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">{label}</div>{children}</div>;
}

function Chips<T extends string>({ values, selected, onSelect }: { values: T[]; selected: T; onSelect: (value: T) => void }) {
  return <div className="flex flex-wrap gap-2">{values.map(value => <button key={value} type="button" onClick={() => onSelect(value)}
    className={selected === value ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white" : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-900"}>{value}</button>)}</div>;
}
