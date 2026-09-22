"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Card = {
  id: string; template: string; background: string; name: string; handle: string;
  photo_data_url: string | null; headline: string; body: string; closing: string;
  stat: string; stat_label: string; source: string;
};

function escapeXml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrap(text: string, max: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > max && line) {
      out.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) out.push(line);
  return out;
}

function fitLines(text: string, maxChars: number, maxLines: number) {
  const lines = wrap(text, maxChars);
  if (lines.length <= maxLines) return lines;

  for (let width = maxChars + 2; width <= Math.max(maxChars + 2, Math.ceil(text.trim().length / maxLines) + 2); width += 2) {
    const widened = wrap(text, width);
    if (widened.length <= maxLines) return widened;
  }

  const fitted = lines.slice(0, maxLines);
  fitted[maxLines - 1] = fitted[maxLines - 1].replace(/[.!,;:?]+$/, "") + "…";
  return fitted;
}

function buildSvg(card: Card) {
  const dark = card.background === "dark";
  const text = dark ? "#fff" : "#171717";
  const muted = dark ? "#b9b9b9" : "#777";
  const headline = fitLines(card.headline, 25, 4);
  const body = fitLines(card.body, 42, 8);
  const closing = fitLines(card.closing, 32, 4);
  const statLabel = fitLines(card.stat_label, 31, 5);

  const lines = (items: string[], x: number, y: number, size: number, weight: number, gap: number) =>
    items.map((v, i) => `<text x="${x}" y="${y + i * gap}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${text}">${escapeXml(v)}</text>`).join("");

  const avatar = card.photo_data_url
    ? `<defs><clipPath id="a"><circle cx="116" cy="114" r="52"/></clipPath></defs><image href="${escapeXml(card.photo_data_url)}" x="64" y="62" width="104" height="104" preserveAspectRatio="xMidYMid slice" clip-path="url(#a)"/>`
    : `<circle cx="116" cy="114" r="52" fill="${text}"/><text x="116" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" fill="${dark ? "#151515" : "#fff"}">${escapeXml((card.name || "P").slice(0,1).toUpperCase())}</text>`;

  const headlineSize = headline.length >= 4 ? 50 : headline.length === 3 ? 58 : 64;
  const headlineGap = headlineSize * 1.08;
  const headlineY = card.template === "editorial" ? 300 : 250;
  const bodySize = body.length >= 8 ? 24 : body.length >= 6 ? 27 : 29;
  const bodyGap = body.length >= 8 ? 34 : 39;
  const bodyY = headlineY + (headline.length - 1) * headlineGap + headlineSize + 46;
  const bodyEnd = bodyY + Math.max(1, body.length - 1) * bodyGap + bodySize;
  const divider = card.template === "editorial" ? bodyEnd + 36 : bodyEnd + 24;
  const closingSize = closing.length >= 4 ? 24 : closing.length >= 3 ? 27 : 29;
  const closingGap = closing.length >= 4 ? 33 : 37;
  const closingY = card.template === "editorial" ? divider + 58 : bodyEnd + 58;

  let content = "";
  if (card.template === "stat") {
    const statSize = card.stat.length > 6 ? 112 : 132;
    const statY = 285;
    const statLabelY = statY + statSize + 55;
    const statLabelGap = statLabel.length >= 5 ? 38 : 42;
    const statClosingY = statLabelY + statLabel.length * statLabelGap + 55;
    content = `
      <text x="68" y="${statY}" font-family="Arial,sans-serif" font-size="${statSize}" font-weight="700" fill="${text}">${escapeXml(card.stat)}</text>
      ${lines(statLabel, 68, statLabelY, statLabel.length >= 5 ? 29 : 32, 400, statLabelGap)}
      ${lines(closing, 68, statClosingY, closing.length >= 4 ? 25 : 29, 600, closing.length >= 4 ? 33 : 38)}
    `;
  } else {
    content = `
      ${lines(headline, 68, headlineY, headlineSize, 500, headlineGap)}
      ${lines(body, 68, bodyY, bodySize, 400, bodyGap)}
      ${card.template === "editorial" ? `<line x1="68" y1="${divider}" x2="193" y2="${divider}" stroke="${text}" stroke-width="7" stroke-linecap="round"/>` : ""}
      ${lines(closing, 68, closingY, closingSize, 600, closingGap)}
    `;
  }

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
