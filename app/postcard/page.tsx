"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Template = "editorial" | "insight" | "stat";
type BackgroundId = "paper" | "gradient" | "dark" | "photo" | "minimal" | "abstract" | "ink" | "nature";

const templates: { id: Template; name: string; description: string }[] = [
  { id: "editorial", name: "Editorial", description: "Profile-led thought card" },
  { id: "insight", name: "Insight", description: "One idea, big and clear" },
  { id: "stat", name: "Statistic", description: "Lead with a number" },
];

const backgrounds: { id: BackgroundId; name: string; className: string }[] = [
  { id: "paper", name: "Paper", className: "bg-[#f4f1e9]" },
  { id: "gradient", name: "Gradient", className: "bg-[linear-gradient(135deg,#f7d6c9,#c9d8ff)]" },
  { id: "dark", name: "Dark", className: "bg-[#151515]" },
  { id: "photo", name: "Photo", className: "bg-[linear-gradient(160deg,#b8d3df,#7896a0)]" },
  { id: "minimal", name: "Minimal", className: "bg-[#f7f5ef]" },
  { id: "abstract", name: "Abstract", className: "bg-[linear-gradient(160deg,#e8edf5,#d6dce7)]" },
  { id: "ink", name: "Ink", className: "bg-[linear-gradient(135deg,#f5e9dc,#303640)]" },
  { id: "nature", name: "Nature", className: "bg-[linear-gradient(145deg,#edf0df,#cbd8c0)]" },
];

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxChars: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? line + " " + word : word;
    if (next.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function initial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "P";
}

export default function PostCardPage() {
  const [template, setTemplate] = useState<Template>("editorial");
  const [name, setName] = useState("Your Name");
  const [handle, setHandle] = useState("@yourhandle");
  const [headline, setHeadline] = useState("Working hard is not your edge anymore.");
  const [body, setBody] = useState(
    "It is the minimum price of entry. What separates you is where you direct that effort, and who grows because of it."
  );
  const [closing, setClosing] = useState(
    "Work earns a seat, but people-centered impact builds a legacy."
  );
  const [stat, setStat] = useState("26%");
  const [statLabel, setStatLabel] = useState("of Anthropic's R&D work is now led by Claude");
  const [source, setSource] = useState("Source: PostCard");
  const [photo, setPhoto] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundId>("paper");
  const [downloading, setDownloading] = useState(false);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState("");
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = useMemo(() => initial(name), [name]);

  useEffect(() => {
    fetch("/api/linkedin/status").then((response) => response.json()).then((data) => setLinkedinConnected(Boolean(data?.connected))).catch(() => undefined);
  }, []);

  function loadPhoto(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
  }

  function buildSvg(backgroundId = background) {
    const safeName = escapeXml(name);
    const safeHandle = escapeXml(handle);
    const safeHeadline = escapeXml(headline);
    const safeBody = escapeXml(body);
    const safeClosing = escapeXml(closing);
    const safeStat = escapeXml(stat);
    const safeStatLabel = escapeXml(statLabel);
    const safeSource = escapeXml(source);
    const headlineLines = wrapText(headline, template === "stat" ? 24 : template === "editorial" ? 25 : 27);
    const bodyLines = wrapText(body, 42);
    const closingLines = wrapText(closing, 32);
    const textColor = backgroundId === "dark" ? "#ffffff" : "#171717";
    const mutedColor = backgroundId === "dark" ? "#b9b9b9" : "#777";

    const avatar = photo
      ? `<image href="${escapeXml(photo)}" x="64" y="62" width="104" height="104" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
      : `<circle cx="116" cy="114" r="52" fill="#171717"/><text x="116" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" fill="white">${escapeXml(initials)}</text>`;

    const textLines = (lines: string[], x: number, y: number, size: number, weight = 400, gap = size * 1.28) =>
      lines.map((line, index) =>
        `<text x="${x}" y="${y + index * gap}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${textColor}">${line}</text>`
      ).join("");

    let content = "";
    if (template === "stat") {
      content = `
        <text x="68" y="290" font-family="Arial,sans-serif" font-size="132" font-weight="700" fill="${textColor}">${safeStat}</text>
        ${textLines(wrapText(statLabel, 31), 68, 395, 34, 400, 47)}
        ${textLines(wrapText(closing, 38), 68, 590, 30, 400, 41)}
      `;
    } else {
      const contentX = template === "editorial" ? 88 : 68;
      const headlineY = template === "editorial" ? 325 : 250;
      const headlineSize = template === "editorial" ? 64 : 62;
      const headlineGap = template === "editorial" ? 74 : 74;
      const bodyY = headlineY + headlineLines.length * headlineGap + 46;
      const bodyEndY = bodyY + Math.max(1, bodyLines.length) * 45;
      const dividerY = Math.min(790, Math.max(700, bodyEndY + 62));
      const closingY = dividerY + 78;
      content = `
        ${textLines(headlineLines, contentX, headlineY, headlineSize, 500, headlineGap)}
        ${textLines(bodyLines, contentX, bodyY, 31, 400, 45)}
        ${template === "editorial" ? `<line x1="${contentX}" y1="${dividerY}" x2="${contentX + 125}" y2="${dividerY}" stroke="${textColor}" stroke-width="7" stroke-linecap="round"/>` : ""}
        ${textLines(closingLines, contentX, closingY, 31, 600, 42)}
      `;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="1 0 0 0 .91 0 1 0 0 .91 0 0 1 0 .89 0 0 0 .08 0"/></filter>
        <linearGradient id="gradientBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7d6c9"/><stop offset="100%" stop-color="#c9d8ff"/></linearGradient>
        <linearGradient id="photoBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8d3df"/><stop offset="100%" stop-color="#7896a0"/></linearGradient>
        <clipPath id="avatarClip"><circle cx="116" cy="114" r="52"/></clipPath>
      </defs>
      ${backgroundId === "dark"
        ? '<rect width="1080" height="1080" fill="#151515"/><circle cx="900" cy="120" r="260" fill="#2a2a2a" opacity=".65"/>'
        : backgroundId === "gradient"
          ? '<rect width="1080" height="1080" fill="url(#gradientBg)"/>'
          : backgroundId === "photo"
            ? '<rect width="1080" height="1080" fill="url(#photoBg)"/><path d="M0 760L240 570l190 150 180-230 470 350v240H0z" fill="#344e59" opacity=".65"/><path d="M0 820l240-150 190 120 180-180 470 300v170H0z" fill="#1f3943" opacity=".55"/>'
            : backgroundId === "abstract"
              ? '<rect width="1080" height="1080" fill="#e9edf4"/><path d="M-80 620C180 360 360 390 510 540s310 210 650-20v560H-80z" fill="#d7deea"/><path d="M-80 760c260-250 430-210 600-50s310 160 640-70v440H-80z" fill="#c5cedd" opacity=".72"/>'
              : backgroundId === "ink"
                ? '<rect width="1080" height="1080" fill="#f4e9dc"/><path d="M760 0c-40 190-220 260-260 430s170 250 80 430-260 120-420 220H1080V0z" fill="#242b33" opacity=".94"/>'
                : backgroundId === "nature"
                  ? '<rect width="1080" height="1080" fill="#f2f0e7"/><path d="M820 80c-180 140-190 350-60 500s100 280-10 500h330V0z" fill="#d5dfc9"/><path d="M940 160c-150 130-160 320-30 480s80 270 0 440" fill="none" stroke="#839b78" stroke-width="38" opacity=".65"/>'
                  : backgroundId === "minimal"
                    ? '<rect width="1080" height="1080" fill="#f7f5ef"/>'
                    : '<rect width="1080" height="1080" fill="#f4f1e9"/><rect width="1080" height="1080" filter="url(#paper)" opacity=".55"/>'}

      ${template === "editorial" ? `
        ${avatar}
        <text x="188" y="105" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${textColor}">${safeName}</text>
        <text x="188" y="145" font-family="Arial,sans-serif" font-size="28" fill="${mutedColor}">${safeHandle}</text>
        <circle cx="510" cy="96" r="14" fill="#24a8e8"/>
        <path d="M503 96l5 5 9-11" fill="none" stroke="white" stroke-width="4"/>
      ` : `
        <text x="68" y="88" font-family="Arial,sans-serif" font-size="24" font-weight="700" letter-spacing="5" fill="${mutedColor}">POSTCARD</text>
        <text x="68" y="125" font-family="Arial,sans-serif" font-size="20" fill="${mutedColor}">${safeName} · ${safeHandle}</text>
      `}
      ${content}
      <text x="68" y="1008" font-family="Arial,sans-serif" font-size="19" fill="${mutedColor}">${safeSource}</text>
    </svg>`;
  }

  async function renderPngDataUrl(backgroundId: BackgroundId) {
    const svg = buildSvg(backgroundId);
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise<string>((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = 1080;
          canvas.height = 1080;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(new Error("Could not create the image canvas.")); return; }
          ctx.drawImage(image, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        image.onerror = () => reject(new Error("Could not render the PostCard image."));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function publishToLinkedIn() {
    if (!linkedinConnected) { router.push("/api/linkedin/connect"); return; }
    setLinkedinLoading(true);
    setLinkedinMessage("");
    try {
      const backgroundId = background;
      const imageDataUrl = await renderPngDataUrl(backgroundId);
      const response = await fetch("/api/linkedin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commentary: [headline, body, closing].filter(Boolean).join("\n\n"),
          sourceUrl: null,
          sourceTitle: name ? "PostCard by " + name : "PostCard visual",
          imageDataUrl,
          includeSourceImage: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not publish to LinkedIn.");
      setLinkedinMessage("Published to your LinkedIn profile.");
    } catch (error) {
      setLinkedinMessage(error instanceof Error ? error.message : "Could not publish to LinkedIn.");
    } finally {
      setLinkedinLoading(false);
    }
  }
  async function downloadPng(backgroundId = background) {
    setDownloading(true);
    try {
      const svg = buildSvg(backgroundId);
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1080;
        canvas.height = 1080;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(image, 0, 0);
        URL.revokeObjectURL(url);
        canvas.toBlob((png) => {
          if (!png) return;
          const downloadUrl = URL.createObjectURL(png);
          const a = document.createElement("a");
          a.href = downloadUrl;
          a.download = "postcard.png";
          a.click();
          URL.revokeObjectURL(downloadUrl);
        }, "image/png");
        setDownloading(false);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        setDownloading(false);
      };
      image.src = url;
    } catch {
      setDownloading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f7f5] text-neutral-900">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7">
          <div>
            <Link href="/" className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCARD</Link>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">AI visual studio</div>
          </div>
          <nav className="flex items-center gap-5 text-sm text-neutral-500">
            <Link href="/" className="hover:text-neutral-900">PostCraft</Link>
            <Link href="/workspace" className="hover:text-neutral-900">Workspace</Link>
          </nav>
        </header>

        <section className="grid gap-12 py-12 lg:grid-cols-[1fr_540px] lg:items-start lg:py-16">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Visual studio</div>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[.98] tracking-[-0.045em] sm:text-7xl">
              Turn ideas into visuals.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600">
              Create clean, professional social cards from a thought, quote, statistic, or LinkedIn post.
            </p>

            <div className="mt-10 border-t border-neutral-900 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">1 / Choose a format</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTemplate(item.id)}
                    className={`border px-4 py-4 text-left transition ${template === item.id ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 hover:border-neutral-900"}`}
                  >
                    <div className="text-sm font-semibold">{item.name}</div>
                    <div className={`mt-1 text-xs leading-5 ${template === item.id ? "text-neutral-300" : "text-neutral-500"}`}>{item.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 border-t border-neutral-300 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">2 / Write the card</div>

              {template === "stat" ? (
                <div className="mt-5 space-y-5">
                  <Field label="Statistic" value={stat} onChange={setStat} />
                  <Field label="What it means" value={statLabel} onChange={setStatLabel} textarea />
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  {template === "editorial" && (
                    <>
                      <div className="grid gap-5 sm:grid-cols-2">
                        <Field label="Name" value={name} onChange={setName} />
                        <Field label="Handle" value={handle} onChange={setHandle} />
                      </div>
                      <div>
                        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadPhoto(e.target.files?.[0])} />
                        <button type="button" onClick={() => fileRef.current?.click()} className="text-xs font-semibold underline underline-offset-4">
                          {photo ? "Change profile photo" : "Add profile photo"}
                        </button>
                      </div>
                    </>
                  )}
                  <Field label="Main thought" value={headline} onChange={setHeadline} textarea />
                  <Field label="Supporting thought" value={body} onChange={setBody} textarea />
                  <Field label="Closing line" value={closing} onChange={setClosing} textarea />
                </div>
              )}
              <div className="mt-5">
                <Field label="Source / footer" value={source} onChange={setSource} />
              </div>
            </div>

            <div className="mt-10 border-t border-neutral-300 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">3 / Choose a background</div>
              <div className="mt-4 grid grid-cols-4 gap-3">
                {backgrounds.map((item) => (
                  <button key={item.id} type="button" onClick={() => setBackground(item.id)} className="group text-left">
                    <span className={`relative block aspect-square overflow-hidden rounded-lg border-2 transition ${item.className} ${background === item.id ? "border-blue-500 ring-2 ring-blue-100" : "border-transparent group-hover:border-neutral-400"}`}>
                      {background === item.id && <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">✓</span>}
                    </span>
                    <span className="mt-1.5 block text-center text-[11px] text-neutral-500">{item.name}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              <button type="button" onClick={() => downloadPng()} disabled={downloading} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">
                {downloading ? "Creating card..." : "Download PNG →"}
              </button>
              <button type="button" onClick={publishToLinkedIn} disabled={linkedinLoading} className="rounded-full bg-[#0A66C2] px-5 py-3 text-sm font-semibold text-white hover:bg-[#084f96] disabled:opacity-50">
                {linkedinLoading ? "Publishing..." : linkedinConnected ? "Publish to LinkedIn →" : "Connect LinkedIn →"}
              </button>
              <span className="text-xs text-neutral-500">1080 × 1080 · Square social card</span>
              {linkedinMessage && <span className="w-full text-xs text-neutral-600">{linkedinMessage}</span>}
            </div>
          </div>

          <div className="lg:sticky lg:top-8">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">3 / Live preview</div>
                <p className="mt-1 text-sm text-neutral-500">Choose a background on the left to update this preview.</p>
              </div>
              <div className="text-xs text-neutral-400">1080 × 1080</div>
            </div>
            <div className="aspect-square w-full overflow-hidden border border-neutral-200 bg-[#f7f6f2] shadow-[0_20px_60px_rgba(0,0,0,.08)]">
              <div className="h-full w-full [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: buildSvg(background) }} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({ label, value, onChange, textarea = false }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean }) {
  const className = "mt-2 w-full border-b border-neutral-300 bg-transparent px-0 py-2 text-sm outline-none transition focus:border-neutral-900";
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{label}</span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={className + " resize-y leading-6"} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </label>
  );
}
