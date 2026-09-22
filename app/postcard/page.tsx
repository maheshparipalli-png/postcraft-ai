"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeStatisticContent } from "@/lib/postcard/content";

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

function estimateTextWidth(text: string, fontSize: number, fontWeight = 400) {
  const weightFactor = fontWeight >= 600 ? 0.56 : fontWeight >= 500 ? 0.54 : 0.52;
  return text.length * fontSize * weightFactor;
}

function wrapText(text: string, maxWidth: number, fontSize: number, fontWeight = 400) {
  const value = text.trim();
  if (!value) return [];

  const words = value.split(/\s+/);
  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = canvas?.getContext("2d");

  if (ctx) {
    ctx.font = `${fontWeight} ${fontSize}px Arial`;
  }

  const measure = (candidate: string) =>
    ctx ? ctx.measureText(candidate).width : estimateTextWidth(candidate, fontSize, fontWeight);

  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (measure(next) > maxWidth && line) {
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
  maxWidth: number;
  maxLines: number;
  startSize: number;
  minSize: number;
  weight?: number;
  lineHeight?: number;
}) {
  const weight = options.weight ?? 400;
  for (let size = options.startSize; size >= options.minSize; size -= 2) {
    const lines = wrapText(text, options.maxWidth, size, weight);
    if (lines.length <= options.maxLines) {
      return { lines, size, gap: options.lineHeight ?? size * 1.2 };
    }
  }
  const size = options.minSize;
  return { lines: wrapText(text, options.maxWidth, size, weight), size, gap: options.lineHeight ?? size * 1.2 };
}

function fitSingleLine(text: string, maxWidth: number, startSize: number, minSize: number, weight = 400) {
  const value = text.trim();
  if (!value) return { text: "", size: startSize };

  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const ctx = canvas?.getContext("2d");

  if (ctx) {
    for (let size = startSize; size >= minSize; size -= 2) {
      ctx.font = `${weight} ${size}px Arial`;
      if (ctx.measureText(value).width <= maxWidth) return { text: value, size };
    }
  } else {
    for (let size = startSize; size >= minSize; size -= 2) {
      if (estimateTextWidth(value, size, weight) <= maxWidth) return { text: value, size };
    }
  }

  return { text: value, size: minSize };
}

function initial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "P";
}

export default function PostCardPage() {
  const [template, setTemplate] = useState<Template>("editorial");
  const [name, setName] = useState("Your Name");
  const [profileLocked, setProfileLocked] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [handle, setHandle] = useState("@yourhandle");
  const [headline, setHeadline] = useState("Working hard is not your edge anymore.");
  const [body, setBody] = useState(
    "It is the minimum price of entry. What separates you is where you direct that effort, and who grows because of it."
  );
  const [closing, setClosing] = useState(
    "Work earns a seat, but people-centered impact builds a legacy."
  );
  const [stat, setStat] = useState("");
  const [statLabel, setStatLabel] = useState("");
  const [source, setSource] = useState("Source: PostCard");
  const [photo, setPhoto] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundId>("paper");
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedCardId, setSavedCardId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState("");
  const [generationCount, setGenerationCount] = useState(0);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState("");
  const [linkedinCaption, setLinkedinCaption] = useState("");
  const linkedinCommentary = linkedinCaption.trim();
  const [linkedinPublished, setLinkedinPublished] = useState(false);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = useMemo(() => initial(name), [name]);

  useEffect(() => {
    if (template !== "stat") return;
    const normalized = normalizeStatisticContent(stat, stat, statLabel);
    if (normalized.stat && normalized.stat !== stat.trim()) setStat(normalized.stat);
    if (normalized.statLabel && normalized.statLabel !== statLabel.trim()) setStatLabel(normalized.statLabel);
  }, [template]);

  useEffect(() => {
    let cancelled = false;
    async function loadAccountProfile() {
      try {
        const response = await fetch("/api/postcard/profile", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        if (data?.profile) {
          setName(data.profile.name || "");
          setHandle(data.profile.handle || "");
          setPhoto(data.profile.photo || null);
          setProfileLocked(Boolean(data.profile.name && data.profile.handle));
          setEditingProfile(false);
          return;
        }
        const savedProfile = window.localStorage.getItem("postcraft-postcard-profile");
        if (savedProfile) {
          try {
            const localProfile = JSON.parse(savedProfile) as { name?: string; handle?: string; photo?: string | null };
            if (localProfile.name && localProfile.handle) {
              const saveResponse = await fetch("/api/postcard/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: localProfile.name, handle: localProfile.handle, photo: localProfile.photo || null }),
              });
              if (saveResponse.ok && !cancelled) {
                setName(localProfile.name);
                setHandle(localProfile.handle);
                setPhoto(localProfile.photo || null);
                setProfileLocked(true);
                setEditingProfile(false);
                window.localStorage.removeItem("postcraft-postcard-profile");
              }
            }
          } catch {}
        }
      } catch {}
    }
    loadAccountProfile();
    return () => { cancelled = true; };
  }, []);

  async function saveProfile() {
    if (!name.trim() || !handle.trim()) return;
    try {
      const response = await fetch("/api/postcard/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), handle: handle.trim(), photo }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not save profile.");
      setName(data.profile.name);
      setHandle(data.profile.handle);
      setPhoto(data.profile.photo || null);
      setProfileLocked(true);
      setEditingProfile(false);
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : "Could not save profile.");
    }
  }

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
    const normalizedStat = normalizeStatisticContent(stat, stat, statLabel);
    const displayStat = normalizedStat.stat;
    const displayStatLabel = normalizedStat.statLabel;

    const safeName = escapeXml(name);
    const safeHandle = escapeXml(handle);
    const safeHeadline = escapeXml(headline);
    const safeBody = escapeXml(body);
    const safeClosing = escapeXml(closing);
    const safeStat = escapeXml(displayStat || "—");
    const safeStatLabel = escapeXml(displayStatLabel);
    const safeSource = escapeXml(source);
    const textColor = backgroundId === "dark" ? "#ffffff" : "#171717";
    const mutedColor = backgroundId === "dark" ? "#b9b9b9" : "#777";

    const avatar = photo
      ? `<image href="${escapeXml(photo)}" x="64" y="62" width="104" height="104" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatarClip)"/>`
      : `<circle cx="116" cy="114" r="52" fill="#171717"/><text x="116" y="128" text-anchor="middle" font-family="Arial,sans-serif" font-size="40" fill="white">${escapeXml(initials)}</text>`;

    const textLines = (items: string[], x: number, y: number, size: number, weight = 400, gap = size * 1.2, anchor = "start") =>
      items.map((line, index) =>
        `<text x="${x}" y="${y + index * gap}" text-anchor="${anchor}" font-family="Arial,sans-serif" font-size="${size}" font-weight="${weight}" fill="${textColor}">${escapeXml(line)}</text>`
      ).join("");

    let content = "";
    if (template === "stat") {
      const statFit = fitSingleLine(displayStat || "—", 880, 138, 78, 700);
      const labelFit = fitText(displayStatLabel || "Add a short explanation for this statistic.", {
        maxWidth: 820, maxLines: 4, startSize: 38, minSize: 28, weight: 400, lineHeight: 46,
      });
      const closingFit = fitText(closing || "The takeaway matters as much as the number.", {
        maxWidth: 820, maxLines: 3, startSize: 34, minSize: 26, weight: 600, lineHeight: 41,
      });

      const statY = 330;
      const labelY = statY + statFit.size + 72;
      const labelEnd = labelY + Math.max(1, labelFit.lines.length - 1) * labelFit.gap + labelFit.size;
      const dividerY = labelEnd + 48;
      const closingY = dividerY + 58;

      content = `
        <text x="540" y="${statY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="${statFit.size}" font-weight="700" fill="${textColor}">${safeStat}</text>
        ${textLines(labelFit.lines, 540, labelY, labelFit.size, 400, labelFit.gap, "middle")}
        <line x1="68" y1="${dividerY}" x2="193" y2="${dividerY}" stroke="${textColor}" stroke-width="7" stroke-linecap="round"/>
        ${textLines(closingFit.lines, 68, closingY, closingFit.size, 600, closingFit.gap)}
      `;
    } else {
      const headlineFit = fitText(headline || "Your main thought goes here.", {
        maxWidth: 900, maxLines: 5, startSize: 68, minSize: 46, weight: 500, lineHeight: 68,
      });
      const bodyFit = fitText(body || "Add the supporting thought that explains why this matters.", {
        maxWidth: 900, maxLines: 7, startSize: 31, minSize: 25, weight: 400, lineHeight: 38,
      });
      const closingFit = fitText(closing || "End with a clear human takeaway.", {
        maxWidth: 900, maxLines: 4, startSize: 32, minSize: 26, weight: 600, lineHeight: 39,
      });

      const contentX = 68;
      const headlineY = template === "editorial" ? 300 : 250;
      const headlineEnd = headlineY + Math.max(1, headlineFit.lines.length - 1) * headlineFit.gap + headlineFit.size;
      const bodyY = headlineEnd + 50;
      const bodyEnd = bodyY + Math.max(1, bodyFit.lines.length - 1) * bodyFit.gap + bodyFit.size;
      const dividerY = template === "editorial" ? bodyEnd + 34 : bodyEnd + 22;
      const closingY = template === "editorial" ? dividerY + 56 : bodyEnd + 54;

      content = `
        ${textLines(headlineFit.lines, contentX, headlineY, headlineFit.size, 500, headlineFit.gap)}
        ${textLines(bodyFit.lines, contentX, bodyY, bodyFit.size, 400, bodyFit.gap)}
        ${template === "editorial" ? `<line x1="${contentX}" y1="${dividerY}" x2="${contentX + 125}" y2="${dividerY}" stroke="${textColor}" stroke-width="7" stroke-linecap="round"/>` : ""}
        ${textLines(closingFit.lines, contentX, closingY, closingFit.size, 600, closingFit.gap)}
      `;
    }

    let backgroundMarkup = '<rect width="1080" height="1080" fill="#f4f1e9"/><rect width="1080" height="1080" filter="url(#paper)" opacity=".55"/>';
    if (backgroundId === "dark") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#151515"/><circle cx="900" cy="120" r="260" fill="#2a2a2a" opacity=".65"/>';
    } else if (backgroundId === "gradient") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="url(#gradientBg)"/>';
    } else if (backgroundId === "photo") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="url(#photoBg)"/><path d="M0 760L240 570l190 150 180-230 470 350v240H0z" fill="#344e59" opacity=".65"/><path d="M0 820l240-150 190 120 180-180 470 300v170H0z" fill="#1f3943" opacity=".55"/>';
    } else if (backgroundId === "abstract") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#e9edf4"/><path d="M-80 620C180 360 360 390 510 540s310 210 650-20v560H-80z" fill="#d7deea"/><path d="M-80 760c260-250 430-210 600-50s310 160 640-70v440H-80z" fill="#c5cedd" opacity=".72"/>';
    } else if (backgroundId === "ink") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#f4e9dc"/><path d="M760 0c-40 190-220 260-260 430s170 250 80 430-260 120-420 220H1080V0z" fill="#242b33" opacity=".94"/>';
    } else if (backgroundId === "nature") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#f2f0e7"/><path d="M820 80c-180 140-190 350-60 500s100 280-10 500h330V0z" fill="#d5dfc9"/><path d="M940 160c-150 130-160 320-30 480s80 270 0 440" fill="none" stroke="#839b78" stroke-width="38" opacity=".65"/>';
    } else if (backgroundId === "minimal") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#f7f5ef"/>';
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
      <defs>
        <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" stitchTiles="stitch"/><feColorMatrix values="1 0 0 0 .91 0 1 0 0 .91 0 0 1 0 .89 0 0 0 .08 0"/></filter>
        <linearGradient id="gradientBg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#f7d6c9"/><stop offset="100%" stop-color="#c9d8ff"/></linearGradient>
        <linearGradient id="photoBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8d3df"/><stop offset="100%" stop-color="#7896a0"/></linearGradient>
        <clipPath id="avatarClip"><circle cx="116" cy="114" r="52"/></clipPath>
      </defs>
      ${backgroundMarkup}

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
      <text x="68" y="1020" font-family="Arial,sans-serif" font-size="18" fill="${mutedColor}">${safeSource}</text>
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

  async function generateCardCopy() {
    setGenerating(true);
    setGenerateMessage("");
    const nextCount = generationCount + 1;
    const directions = [
      "sports comeback or breakthrough",
      "business decision or company turnaround",
      "entrepreneurship and persistence",
      "leadership and people",
      "an unexpected success lesson",
      "failure, recovery, and resilience",
      "discipline and long-term consistency",
      "learning, craft, or mastery",
      "a remarkable human achievement",
      "a simple everyday lesson with a deeper meaning",
    ];
    const direction = directions[(nextCount - 1) % directions.length];
    const seed = Math.random().toString(36).slice(2, 10);
    setGenerationCount(nextCount);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "postcard",
          template,
          idea: "",
          category: direction,
          variationSeed: seed,
          previousHeadline: headline,
          previousBody: body,
          previousClosing: closing,
          headline: "",
          supportingThought: "",
          closing: "",
          stat,
          source: "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not generate the card copy.");

      if (template === "stat") {
        if (data.stat) setStat(data.stat);
        if (data.statLabel) setStatLabel(data.statLabel);
        if (data.closing) setClosing(data.closing);
      } else {
        if (data.headline) setHeadline(data.headline);
        if (data.body) setBody(data.body);
        if (data.closing) setClosing(data.closing);
      }
      setGenerateMessage("Generated a fresh, human-sounding version.");
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : "Could not generate the card copy.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveCard() {
    const normalizedStat = normalizeStatisticContent(stat, stat, statLabel);
    setSaving(true);
    setSaved(false);
    setGenerateMessage("");
    try {
      const response = await fetch("/api/postcard/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template,
          background,
          name,
          handle,
          photo,
          headline,
          body,
          closing,
          stat: normalizedStat.stat,
          statLabel: normalizedStat.statLabel,
          source,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Could not save the PostCard.");
      setSaved(true);
      setSavedCardId(data.id);
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : "Could not save the PostCard.");
    } finally {
      setSaving(false);
    }
  }

  async function publishToLinkedIn() {
    if (linkedinPublished) return;
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
          commentary: linkedinCommentary,
          sourceUrl: null,
          sourceTitle: name ? "PostCard by " + name : "PostCard visual",
          imageDataUrl,
          includeSourceImage: false,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not publish to LinkedIn.");
      setLinkedinPublished(true);
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
            <Link href="/postcard/saved" className="hover:text-neutral-900">My PostCards</Link>
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">0 / Your brand <span className="font-normal tracking-normal">(optional)</span></div>
              <div className="mt-4 grid gap-5 sm:grid-cols-[120px_1fr_1fr] sm:items-end">
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => loadPhoto(e.target.files?.[0])} />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-neutral-300 bg-neutral-900 text-center text-xs font-semibold text-white transition hover:opacity-90"
                    aria-label={photo ? "Change profile photo" : "Upload profile photo"}
                  >
                    {photo ? (
                      <img src={photo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="px-3">◉<br />Upload photo</span>
                    )}
                  </button>
                </div>
                <Field label="Your Name" value={name} onChange={setName} placeholder="e.g. Mahesh Paripalli" />
                <Field label="Handle (e.g. @yourhandle)" value={handle} onChange={setHandle} placeholder="e.g. @maheshparipalli" />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={!name.trim() || !handle.trim()}
                  className="rounded-full border border-neutral-900 px-4 py-2 text-xs font-semibold hover:bg-neutral-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Save brand profile
                </button>
                {profileLocked && <span className="text-xs text-neutral-500">✓ Profile saved</span>}
                <span className="text-[11px] text-neutral-400">Used on your PostCards and remembered for future cards.</span>
              </div>
            </div>

            <div className="mt-10 border-t border-neutral-900 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">1 / Choose a format</div>
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

            <div className="mt-5">
              <button
                type="button"
                onClick={generateCardCopy}
                disabled={generating}
                className="flex w-full items-center justify-center rounded-md bg-[#1677e8] px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0f67cf] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {generating ? "✦ Generating PostCard..." : "✦ Generate PostCard"}
              </button>
              <p className="mt-2 text-center text-[11px] text-neutral-400">AI creates a fresh thought, supporting insight, and closing line for your selected format.</p>
            </div>

            <div className="mt-10 border-t border-neutral-300 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">2 / Write the card</div>

              {template === "stat" ? (
                <div className="mt-5 space-y-5">
                  <Field
                    label="Statistic"
                    value={stat}
                    onChange={(value) => {
                      const normalized = normalizeStatisticContent(value, value, "");
                      if (normalized.stat) {
                        setStat(normalized.stat);
                        if (normalized.statLabel) setStatLabel(normalized.statLabel);
                      } else {
                        setStat(value);
                      }
                    }}
                    placeholder="e.g. 70%, 3.2x, $4.2B, 1 in 5"
                  />
                  <Field label="What it means" value={statLabel} onChange={setStatLabel} textarea />
                  <p className="text-[11px] leading-5 text-neutral-500">Enter only the number/value here. If you paste a sentence containing a statistic, PostCard will split the value from the explanation.</p>
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <Field label="Main thought" value={headline} onChange={setHeadline} textarea />
                  <Field label="Supporting thought" value={body} onChange={setBody} textarea />
                  <Field label="Closing line" value={closing} onChange={setClosing} textarea />
                  <Field label="LinkedIn caption" value={linkedinCaption} onChange={setLinkedinCaption} textarea />
                  <p className="text-[11px] leading-5 text-neutral-500">
                    This caption is published above the visual. It is separate from the text on the card, so it should add context rather than repeat it.
                  </p>
                </div>
              )}

              {generateMessage && <div className="mt-5 text-xs text-neutral-600">{generateMessage}</div>}

              <div className="mt-5">
                <Field label="Source / footer" value={source} onChange={setSource} />
              </div>
            </div>

            <div className="mt-10 border-t border-neutral-300 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">3 / Choose a background</div>
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
              <button
                type="button"
                onClick={saveCard}
                disabled={saving}
                className={`rounded-full px-5 py-3 text-sm font-semibold transition ${saved ? "border border-green-600 bg-green-50 text-green-700" : "border border-neutral-900 bg-white text-neutral-900 hover:bg-neutral-100"} disabled:opacity-60`}
              >
                {saving ? "Saving..." : saved ? "✓ Saved" : "Save card"}
              </button>
              {savedCardId && <Link href={`/postcard/${savedCardId}`} className="border-b border-neutral-900 pb-1 text-xs font-medium">View saved card →</Link>}
              <button type="button" onClick={() => downloadPng()} disabled={downloading} className="rounded-full bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-700 disabled:opacity-50">
                {downloading ? "Creating card..." : "Download PNG →"}
              </button>
              <button
                type="button"
                onClick={publishToLinkedIn}
                disabled={linkedinLoading || linkedinPublished || !linkedinCommentary}
                className={`rounded-full px-5 py-3 text-sm font-semibold text-white transition ${linkedinPublished ? "cursor-not-allowed bg-neutral-400" : "bg-[#0A66C2] hover:bg-[#084f96]"} disabled:opacity-70`}
              >
                {linkedinLoading ? "Publishing..." : linkedinPublished ? "✓ Published to LinkedIn" : linkedinConnected ? "Publish to LinkedIn →" : "Connect LinkedIn →"}
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

function Field({ label, value, onChange, textarea = false, disabled = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; textarea?: boolean; disabled?: boolean; placeholder?: string }) {
  const className = "mt-2 w-full border-b border-neutral-300 bg-transparent px-0 py-2 text-sm outline-none transition focus:border-neutral-900";
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">{label}</span>
      {textarea ? (
        <textarea rows={3} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className + " resize-y leading-6 disabled:cursor-not-allowed disabled:text-neutral-400"} />
      ) : (
        <input value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className + " disabled:cursor-not-allowed disabled:text-neutral-400"} />
      )}
    </label>
  );
}
