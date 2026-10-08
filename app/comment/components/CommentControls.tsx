"use client";

import type { Depth, Platform, Position, Style } from "../lib/types";
import { depths, platforms, positions, styles } from "../lib/types";

export default function CommentControls({ platform, position, selectedStyles, depth, setPlatform, setPosition, toggleStyle, setDepth }: {
  platform: Platform; position: Position; selectedStyles: Style[]; depth: Depth;
  setPlatform: (value: Platform) => void; setPosition: (value: Position) => void;
  toggleStyle: (value: Style) => void; setDepth: (value: Depth) => void;
}) {
  return <section className="space-y-8">
    <div className="border border-neutral-200 bg-white p-6"><Label text="Where are you commenting?" /><Chips values={platforms} selected={platform} onSelect={setPlatform} /></div>
    <div className="border border-neutral-200 bg-white p-6"><Label text="Your position" /><Chips values={positions} selected={position} onSelect={setPosition} /></div>
    <div className="border border-neutral-200 bg-white p-6">
      <Label text="Comment style" />
      <div className="flex flex-wrap gap-2">{styles.map(style => <button key={style} type="button" onClick={() => toggleStyle(style)}
        className={selectedStyles.includes(style) ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white" : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-900"}>{style}</button>)}</div>
    </div>
    <div className="border border-neutral-200 bg-white p-6"><Label text="Depth" /><Chips values={depths} selected={depth} onSelect={setDepth} /></div>
  </section>;
}

function Label({ text }: { text: string }) {
  return <div className="mb-4 text-[10px] font-semibold uppercase tracking-[.16em] text-neutral-400">{text}</div>;
}

function Chips<T extends string>({ values, selected, onSelect }: { values: T[]; selected: T; onSelect: (value: T) => void }) {
  return <div className="flex flex-wrap gap-2">{values.map(value => <button key={value} type="button" onClick={() => onSelect(value)}
    className={selected === value ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-semibold text-white" : "rounded-full border border-neutral-300 bg-white px-3.5 py-2 text-xs font-medium text-neutral-600 hover:border-neutral-900"}>{value}</button>)}</div>;
}
