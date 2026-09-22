"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { normalizeStatisticContent } from "@/lib/postcard/content";

type Card = {
  id: string; template: string; background: string; name: string; handle: string;
  photo_data_url: string | null; headline: string; body: string; closing: string;
  stat: string; stat_label: string; source: string;
};

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrapText(text: string, maxWidth: number, fontSize: number, fontWeight = 400) {
  const value = text.trim();
  if (!value) return [];
  if (typeof document === "undefined") return value.split(/\s+/);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return [value];
  ctx.font = `${fontWeight} ${fontSize}px Arial`;
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function fitText(text: string, options: {
  maxWidth: number; maxLines: number; startSize: number; minSize: number; weight?: number; lineHeight?: number;
}) {
  const weight = options.weight ?? 400;
  for (let size = options.startSize; size >= options.minSize; size -= 2) {
    const lines = wrapText(text, options.maxWidth, size, weight);
    if (lines.length <= options.maxLines) return { lines, size, gap: options.lineHeight ?? size * 1.2 };
  }
  const size = options.minSize;
  return { lines: wrapText(text, options.maxWidth, size, weight), size, gap: options.lineHeight ?? size * 1.2 };
}

function fitSingleLine(text: string, maxWidth: number, startSize: number, minSize: number, weight = 400) {
  const value = text.trim();
  if (!value) return { text: "", size: startSize };
  if (typeof document === "undefined") return { text: value, size: minSize };
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { text: value, size: minSize };
  for (let size = startSize; size >= minSize; size -= 2) {
    ctx.font = `${weight} ${size}px Arial`;
    if (ctx.measureText(value).width <= maxWidth) return { text: value, size };
  }
  return { text: value, size: minSize };
}

function buildSvg(card: Card) {
  const dark = card.background === "dark";
  const text = dark ? "#fff" : "#171717";
  const muted = dark ? "#b9b9b9" : "#777";
  const normalizedStat = normalizeStatisticContent(card.stat, card.stat, card.stat_label);
  const displayStat = normalizedStat.stat;
  const displayStatLabel = normalizedStat.statLabel;

  const headlineFit = fitText(card.headline || "Your main thought goes here.", {
    maxWidth: 900, maxLines: 5, startSize: 68, minSize: 46, weight: 500, lineHeight: 68,
  });
  const bodyFit = fitText(card.body || "Add the supporting thought that explains why this matters.", {
    maxWidth: 900, maxLines: 7, startSize: 31, minSize: 25, weight: 400, lineHeight: 38,
  });
  const closingFit = fitText(card.closing || "End with a clear human takeaway.", {
    maxWidth: 820, maxLines: card.template === "stat" ? 3 : 4, startSize: 34, minSize: 26, weight: 600, lineHeight: 41,
  });

  const lines = (items: string[], x: number, y: number, size: number, weight: number, gap: number, anchor = "start") =>
    items.map((v, i) => `<text x="${x}" y="${y + i * gap}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${text}">${escapeXml(v)}</text>`).join("");

  let content = "";
  if (card.template === "stat") {
    const statFit = fitSingleLine(displayStat || "—", 880, 138, 78, 700);
    const labelFit = fitText(displayStatLabel || "Add a short explanation for this statistic.", {
      maxWidth: 820, maxLines: 4, startSize: 38, minSize: 28, weight: 400, lineHeight: 46,
    });
    const statY = 330;
    const labelY = statY + statFit.size + 72;
    const labelEnd = labelY + Math.max(1, labelFit.lines.length - 1) * labelFit.gap + labelFit.size;
    const dividerY = labelEnd + 48;
    const closingY = dividerY + 58;
    content = `
      <text x="540" y="${statY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${statFit.size}" font-weight="700" fill="${text}">${escapeXml(displayStat || "—")}</text>
      ${lines(labelFit.lines, 540, labelY, labelFit.size, 400, labelFit.gap, "middle")}
      <line x1="68" y1="${dividerY}" x2="193" y2="${dividerY}" stroke="${text}" stroke-width="7" stroke-linecap="round"/>
      ${lines(closingFit.lines, 68, closingY, closingFit.size, 600, closingFit.gap)}
    `;
  } else {
    const headlineY = card.template === "editorial" ? 300 : 250;
    const headlineEnd = headlineY + Math.max(1, headlineFit.lines.length - 1) * headlineFit.gap + headlineFit.size;
    const bodyY = headlineEnd + 50;
    const bodyEnd = bodyY + Math.max(1, bodyFit.lines.length - 1) * bodyFit.gap + bodyFit.size;
    const divider = card.template === "editorial" ? bodyEnd + 34 : bodyEnd + 22;
    const closingY = card.template === "editorial" ? divider + 56 : bodyEnd + 54;
    content = `
      ${lines(headlineFit.lines, 68, headlineY, headlineFit.size, 500, headlineFit.gap)}
      ${lines(bodyFit.lines, 68, bodyY, bodyFit.size, 400, bodyFit.gap)}
      ${card.template === "editorial" ? `<line x1="68" y1="${divider}" x2="193" y2="${divider}" stroke="${text}" stroke-width="7" stroke-linecap="round"/>` : ""}
      ${lines(closingFit.lines, 68, closingY, closingFit.size, 600, closingFit.gap)}
    `;
  }

  const avatar = card.photo_data_url
    ? `<defs><clipPath id="a"><circle cx="116" cy="114" r="52"/></clipPath></defs><image href="${escapeXml(card.photo_data_url)}" x="64" y="62" width="104" height="104" preserveAspectRatio="xMidYMid slice" clip-path="url(#a)"/>`
    : `<circle cx="116" cy="114" r="52" fill="${text}"/><text x="116" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" fill="${dark ? "#151515" : "#fff"}">${escapeXml((card.name || "P").slice(0,1).toUpperCase())}</text>`;

  const bg = dark
    ? '<rect width="1080" height="1080" fill="#151515"/><circle cx="900" cy="120" r="260" fill="#2a2a2a" opacity=".65"/>'
    : '<rect width="1080" height="1080" fill="#f4f1e9"/>';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">${bg}
    ${card.template === "editorial" ? `${avatar}<text x="188" y="105" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${text}">${escapeXml(card.name)}</text><text x="188" y="145" font-family="Arial,sans-serif" font-size="28" fill="${muted}">${escapeXml(card.handle)}</text>` : `<text x="68" y="88" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="${muted}">POSTCARD</text><text x="68" y="125" font-family="Arial,sans-serif" font-size="20" fill="${muted}">${escapeXml(card.name)} · ${escapeXml(card.handle)}</text>`}
    ${content}
    <text x="68" y="1020" font-family="Arial,sans-serif" font-size="18" fill="${muted}">${escapeXml(card.source || "")}</text>
  </svg>`;
}

export default function SavedPostcardPage({ params }: { params: { id: string } }) {
  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/postcard/cards/${encodeURIComponent(params.id)}`, { cache: "no-store" })
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d?.error || "Could not load this PostCard.");
        setCard(d.card);
      })
      .catch(e => setError(e instanceof Error ? e.message : "Could not load this PostCard."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const svg = useMemo(() => card ? buildSvg(card) : "", [card]);

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-neutral-900">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <header className="flex items-center justify-between border-b border-neutral-300 pb-6">
          <Link href="/postcard" className="font-serif text-xl font-semibold">POSTCARD</Link>
          <nav className="flex gap-5 text-sm text-neutral-500">
            <Link href="/postcard/saved">My PostCards</Link>
            <Link href="/postcard">Create</Link>
          </nav>
        </header>
        {loading ? <p className="py-20 text-sm text-neutral-500">Loading…</p> :
          error ? <p className="py-20 text-sm text-red-700">{error}</p> :
          card ? <section className="grid gap-10 py-10 lg:grid-cols-[minmax(0,720px)_1fr] lg:items-start">
            <div className="overflow-hidden border border-neutral-200 bg-white shadow-[0_20px_60px_rgba(0,0,0,.08)]">
              <div className="aspect-square w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{__html:svg}} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-400">Saved PostCard</div>
              <h1 className="mt-3 font-serif text-4xl leading-tight">{card.headline || card.stat || "Untitled PostCard"}</h1>
              <p className="mt-4 text-sm leading-6 text-neutral-600">Saved {new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(new Date())}.</p>
              <Link href="/postcard" className="mt-7 inline-block rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white">Create another →</Link>
            </div>
          </section> : null}
      </div>
    </main>
  );
}
