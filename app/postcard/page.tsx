"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Template = "quote" | "story" | "success" | "person" | "history" | "thought" | "mindful";
type BackgroundId = "gradient" | "dark" | "photo" | "minimal" | "abstract" | "ink" | "nature";

const quoteFields = ["resilience", "leadership", "entrepreneurship", "discipline", "creativity", "learning", "courage", "success", "life", "sports"] as const;

const templates: { id: Template; name: string; description: string }[] = [
  { id: "quote", name: "Motivational Quote", description: "Real quote from a curated feed" },
  { id: "story", name: "Motivational Story", description: "Short story with a life lesson" },
  { id: "success", name: "Success Story", description: "Achievement, comeback, or breakthrough" },
  { id: "person", name: "Person of the Day", description: "An inspiring person and their lesson" },
  { id: "history", name: "Historical Moment", description: "A moment from history with a modern lesson" },
  { id: "thought", name: "Thought Experiment", description: "A question that makes people think" },
  { id: "mindful", name: "Mindful Movement", description: "A small action to slow down and reset" },
];

const backgrounds: { id: BackgroundId; name: string; className: string }[] = [
  { id: "gradient", name: "Gradient", className: "bg-[linear-gradient(135deg,#dff5fb,#c9d8ff_58%,#9b8cff)]" },
  { id: "ink", name: "Ink", className: "bg-[linear-gradient(135deg,#f4e9dc,#303640)]" },
  { id: "dark", name: "Dark", className: "bg-[linear-gradient(145deg,#0f172a,#25334a)]" },
  { id: "minimal", name: "Minimal", className: "bg-[#f7f5ef]" },
  { id: "abstract", name: "Abstract", className: "bg-[linear-gradient(160deg,#e8edf5,#d6dce7)]" },
  { id: "nature", name: "Nature", className: "bg-[linear-gradient(145deg,#edf0df,#cbd8c0)]" },
  { id: "photo", name: "Photo", className: "bg-[linear-gradient(160deg,#d7e9f2,#8caec1)]" },
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
  const [template, setTemplate] = useState<Template>("quote");
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
  const [quoteField, setQuoteField] = useState<(typeof quoteFields)[number]>("resilience");
  const [quoteHash, setQuoteHash] = useState<string | null>(null);
  const [quoteAuthor, setQuoteAuthor] = useState("");
  const [storyHash, setStoryHash] = useState<string | null>(null);
  const [storySourceName, setStorySourceName] = useState("");
  const [storySourceTitle, setStorySourceTitle] = useState("");
  const [storySourceUrl, setStorySourceUrl] = useState("");
  const [storyCategory, setStoryCategory] = useState("");
  const [source, setSource] = useState("Source: PostCard");
  const [photo, setPhoto] = useState<string | null>(null);
  const [background, setBackground] = useState<BackgroundId>("gradient");
  const [downloading, setDownloading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [savedCardId, setSavedCardId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState("");
  const [generationCount, setGenerationCount] = useState(0);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState("");
  const [linkedinCaption, setLinkedinCaption] = useState("");
  const linkedinCommentary = linkedinCaption.trim() || (template === "quote" ? [headline.trim(), body.trim()].filter(Boolean).join("\n\n") : body.trim() || headline.trim());
  const [linkedinPublished, setLinkedinPublished] = useState(false);
  const router = useRouter();
  const [linkedinNotice, setLinkedinNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const initials = useMemo(() => initial(name), [name]);



  useEffect(() => {
    let cancelled = false;

    async function applyLocalProfile() {
      try {
        const savedProfile = window.localStorage.getItem("postcraft-postcard-profile");
        if (!savedProfile) return false;
        const localProfile = JSON.parse(savedProfile) as { name?: string; handle?: string; photo?: string | null };
        if (!localProfile.name || !localProfile.handle || cancelled) return false;
        setName(localProfile.name);
        setHandle(localProfile.handle);
        setPhoto(localProfile.photo || null);
        setProfileLocked(true);
        setEditingProfile(false);
        return true;
      } catch {
        return false;
      }
    }

    async function loadAccountProfile() {
      const localLoaded = await applyLocalProfile();

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
          window.localStorage.setItem(
            "postcraft-postcard-profile",
            JSON.stringify({
              name: data.profile.name || "",
              handle: data.profile.handle || "",
              photo: data.profile.photo || null,
            }),
          );
        } else if (!localLoaded) {
          setProfileLocked(false);
        }
      } catch {
        // Local profile remains available when account storage is unavailable.
      }
    }

    loadAccountProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveProfile() {
    if (!name.trim() || !handle.trim()) return;

    const profile = {
      name: name.trim(),
      handle: handle.trim(),
      photo: photo || null,
    };

    setProfileSaving(true);
    setProfileMessage("");

    // Save locally first so the profile is immediately remembered on this browser.
    window.localStorage.setItem("postcraft-postcard-profile", JSON.stringify(profile));
    setName(profile.name);
    setHandle(profile.handle);
    setPhoto(profile.photo);
    setProfileLocked(true);
    setEditingProfile(false);

    try {
      const response = await fetch("/api/postcard/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setProfileMessage("Saved on this device. Sign in to sync this profile to your account.");
        return;
      }

      const saved = {
        name: data.profile.name,
        handle: data.profile.handle,
        photo: data.profile.photo || null,
      };
      window.localStorage.setItem("postcraft-postcard-profile", JSON.stringify(saved));
      setName(saved.name);
      setHandle(saved.handle);
      setPhoto(saved.photo);
      setProfileMessage("Profile saved to your account.");
    } catch {
      setProfileMessage("Saved on this device. Account sync will retry when available.");
    } finally {
      setProfileSaving(false);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("linkedinConnected") === "1") setLinkedinNotice("LinkedIn connected successfully.");
    const error = params.get("linkedinError");
    if (error) setLinkedinNotice(error);
    if (params.has("linkedinConnected") || params.has("linkedinError")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

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
    if (template === "quote") {
      const quoteFit = fitText(headline || "Your motivational quote goes here.", {
        maxWidth: 900, maxLines: 6, startSize: 64, minSize: 42, weight: 500, lineHeight: 66,
      });
      const authorFit = fitSingleLine(body || (quoteAuthor ? `— ${quoteAuthor}` : ""), 820, 30, 22, 400);
      const quoteY = 300;
      const quoteEnd = quoteY + Math.max(1, quoteFit.lines.length - 1) * quoteFit.gap + quoteFit.size;
      const authorY = quoteEnd + 72;

      content = `
        <text x="68" y="255" font-family="Georgia,serif" font-size="96" font-weight="700" fill="${textColor}" opacity=".18">“</text>
        ${textLines(quoteFit.lines, 68, quoteY, quoteFit.size, 500, quoteFit.gap)}
        ${body ? `<text x="68" y="${authorY}" font-family="Arial,sans-serif" font-size="${authorFit.size}" font-weight="400" fill="${mutedColor}">${escapeXml(authorFit.text)}</text>` : ""}
      `;
    } else if (template === "story") {
      const titleFit = fitText(headline || "Your motivational story title.", {
        maxWidth: 900, maxLines: 3, startSize: 58, minSize: 40, weight: 600, lineHeight: 62,
      });
      const bodyFit = fitText(body || "Generate a short story with a turning point and a lesson.", {
        maxWidth: 900, maxLines: 11, startSize: 29, minSize: 22, weight: 400, lineHeight: 35,
      });
      const lessonFit = fitText(closing || "The lesson stays with you.", {
        maxWidth: 900, maxLines: 3, startSize: 31, minSize: 25, weight: 600, lineHeight: 38,
      });
      const titleY = 255;
      const titleEnd = titleY + Math.max(1, titleFit.lines.length - 1) * titleFit.gap + titleFit.size;
      const bodyY = titleEnd + 42;
      const bodyEnd = bodyY + Math.max(1, bodyFit.lines.length - 1) * bodyFit.gap + bodyFit.size;
      const dividerY = bodyEnd + 28;
      const lessonY = dividerY + 52;

      content = `
        <text x="68" y="215" font-family="Arial,sans-serif" font-size="18" font-weight="700" letter-spacing="3" fill="${mutedColor}">A SHORT STORY</text>
        ${textLines(titleFit.lines, 68, titleY, titleFit.size, 600, titleFit.gap)}
        ${textLines(bodyFit.lines, 68, bodyY, bodyFit.size, 400, bodyFit.gap)}
        <line x1="68" y1="${dividerY}" x2="193" y2="${dividerY}" stroke="${textColor}" stroke-width="7" stroke-linecap="round"/>
        ${textLines(lessonFit.lines, 68, lessonY, lessonFit.size, 600, lessonFit.gap)}
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
      const formatLabel = ({
        success: "A SUCCESS STORY",
        person: "PERSON OF THE DAY",
        history: "A MOMENT IN HISTORY",
        thought: "THOUGHT EXPERIMENT",
        mindful: "MINDFUL MOVEMENT",
      } as Record<string, string>)[template] || "POSTCARD";
      const headlineY = 285;
      const headlineEnd = headlineY + Math.max(1, headlineFit.lines.length - 1) * headlineFit.gap + headlineFit.size;
      const bodyY = headlineEnd + 50;
      const bodyEnd = bodyY + Math.max(1, bodyFit.lines.length - 1) * bodyFit.gap + bodyFit.size;
      const dividerY = bodyEnd + 26;
      const closingY = dividerY + 56;

      content = `
        ${textLines([formatLabel], contentX, 220, 18, 700, 24)}
        ${textLines(headlineFit.lines, contentX, headlineY, headlineFit.size, 500, headlineFit.gap)}
        ${textLines(bodyFit.lines, contentX, bodyY, bodyFit.size, 400, bodyFit.gap)}
        <line x1="${contentX}" y1="${dividerY}" x2="${contentX + 125}" y2="${dividerY}" stroke="${textColor}" stroke-width="7" stroke-linecap="round"/>
        ${textLines(closingFit.lines, contentX, closingY, closingFit.size, 600, closingFit.gap)}
      `;
    }

    let backgroundMarkup = '<rect width="1080" height="1080" fill="#dff5fb"/>';
    if (backgroundId === "dark") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#151515"/><circle cx="900" cy="120" r="260" fill="#2a2a2a" opacity=".65"/>';
    } else if (backgroundId === "gradient") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="url(#gradientBg)"/><path d="M-60 840C180 690 320 730 480 800s310 80 660-210v490H-60z" fill="#6f8fff" opacity=".22"/><path d="M-60 930C210 760 390 820 550 875s300 50 650-220v425H-60z" fill="#6d4cff" opacity=".18"/>';
    } else if (backgroundId === "photo") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="url(#photoBg)"/><circle cx="820" cy="230" r="115" fill="#f8e4bd" opacity=".9"/><path d="M0 690L220 500l170 150 190-250 500 390v290H0z" fill="#7896a0" opacity=".88"/><path d="M0 800l210-155 180 125 200-175 490 310v175H0z" fill="#46636e" opacity=".92"/><path d="M0 905l220-125 180 110 200-140 480 245v150H0z" fill="#304d58" opacity=".88"/>';
    } else if (backgroundId === "abstract") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#e9edf4"/><path d="M-80 620C180 360 360 390 510 540s310 210 650-20v560H-80z" fill="#d7deea"/><path d="M-80 760c260-250 430-210 600-50s310 160 640-70v440H-80z" fill="#c5cedd" opacity=".72"/>';
    } else if (backgroundId === "ink") {
      backgroundMarkup = '<rect width="1080" height="1080" fill="#f4e9dc"/><path d="M760 0c-40 190-220 260-260 430s170 250 80 430-260 120-420 220H1080V0z" fill="#242b33" opacity=".97"/><path d="M860 -20C790 170 900 250 980 310s60 120 150 190" fill="none" stroke="#d9a13a" stroke-width="8" opacity=".95"/><path d="M850 0C800 160 880 230 955 290" fill="none" stroke="#d9a13a" stroke-width="3" opacity=".7"/> ';
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

      ${avatar}
      <text x="188" y="105" font-family="Arial,sans-serif" font-size="36" font-weight="700" fill="${textColor}">${safeName}</text>
      <text x="188" y="145" font-family="Arial,sans-serif" font-size="28" fill="${mutedColor}">${safeHandle}</text>
      <circle cx="510" cy="96" r="14" fill="#24a8e8"/>
      <path d="M503 96l5 5 9-11" fill="none" stroke="white" stroke-width="4"/>
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

    if (template === "quote") {
      try {
        const response = await fetch(`/api/postcard/quote?field=${encodeURIComponent(quoteField)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data?.quote) throw new Error(data?.error || "Could not retrieve a motivational quote.");
        setHeadline(data.quote.text || "");
        setBody(data.quote.author ? `— ${data.quote.author}` : "");
        setClosing("");
        setSource(data.attribution || "Inspirational quotes provided by ZenQuotes API");
        setQuoteHash(data.quote.hash || null);
        setQuoteAuthor(data.quote.author || "");
        setStoryHash(null);
        setStorySourceName("");
        setStorySourceTitle("");
        setStorySourceUrl("");
        setStoryCategory("");
        setGenerationCount(nextCount);
        setGenerateMessage(`Fresh ${data.quote.category || quoteField} quote selected.`);
      } catch (error) {
        setGenerateMessage(error instanceof Error ? error.message : "Could not retrieve a motivational quote.");
      } finally {
        setGenerating(false);
      }
      return;
    }

    if (template === "story") {
      try {
        const categories = ["resilience", "courage", "discipline", "leadership", "entrepreneurship", "learning", "life", "achievement", "sports"];
        const category = storyCategory || categories[(nextCount - 1) % categories.length];
        const response = await fetch(`/api/postcard/story?category=${encodeURIComponent(category)}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data?.story) throw new Error(data?.error || "Could not retrieve a motivational story.");
        setHeadline(data.story.title || "");
        setBody(data.story.body || "");
        setClosing(data.story.lesson || "");
        setStoryHash(data.story.hash || null);
        setStorySourceName(data.story.sourceName || "");
        setStorySourceTitle(data.story.sourceTitle || "");
        setStorySourceUrl(data.story.sourceUrl || "");
        setStoryCategory(data.story.category || category);
        setSource(data.story.sourceName ? `Inspired by: ${data.story.sourceName}` : "Source: PostCard");
        setQuoteHash(null);
        setQuoteAuthor("");
        setGenerationCount(nextCount);
        setGenerateMessage(`Fresh ${data.story.category || category} story selected.`);
      } catch (error) {
        setGenerateMessage(error instanceof Error ? error.message : "Could not retrieve a motivational story.");
      } finally {
        setGenerating(false);
      }
      return;
    }

    const directions: Record<Exclude<Template, "quote" | "story">, string> = {
      success: "a true-to-life success, comeback, breakthrough, or achievement story",
      person: "an inspiring person, their journey, and one useful lesson from their life or work",
      history: "a historical moment, what happened, and why it still matters today",
      thought: "a thought experiment built around a surprising but useful question",
      mindful: "a small mindful movement or reset practice that someone can do today",
    };
    const direction = directions[template as Exclude<Template, "quote" | "story">] || "a practical life lesson";
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
          source: "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not generate the card copy.");
      if (data.headline) setHeadline(data.headline);
      if (data.body) setBody(data.body);
      if (data.closing) setClosing(data.closing);
      setGenerateMessage("Generated a fresh, human-sounding version.");
    } catch (error) {
      setGenerateMessage(error instanceof Error ? error.message : "Could not generate the card copy.");
    } finally {
      setGenerating(false);
    }
  }
  async function saveCard() {
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
          stat: "",
          statLabel: "",
          source,
          quoteHash: template === "quote" ? quoteHash : null,
          quoteText: template === "quote" ? headline : "",
          quoteAuthor: template === "quote" ? quoteAuthor : "",
          quoteCategory: template === "quote" ? quoteField : "",
          storyHash: template === "story" ? storyHash : null,
          storySourceName: template === "story" ? storySourceName : "",
          storySourceTitle: template === "story" ? storySourceTitle : "",
          storySourceUrl: template === "story" ? storySourceUrl : "",
          storyCategory: template === "story" ? storyCategory : "",
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
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/" className="text-neutral-500 hover:text-neutral-900">PostCraft</Link>
            <Link
              href="/postcard/saved"
              className="rounded-full border border-neutral-900 bg-white px-4 py-2 text-xs font-semibold text-neutral-900 transition hover:bg-neutral-900 hover:text-white"
            >
              Saved PostCards →
            </Link>
          </nav>
        </header>

        <section className="grid gap-12 py-12 lg:grid-cols-[1fr_540px] lg:items-start lg:py-16">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Visual studio</div>
            <h1 className="mt-5 max-w-3xl font-serif text-5xl leading-[.98] tracking-[-0.045em] sm:text-7xl">
              Turn ideas into visuals.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-neutral-600">
              Create clean, professional social cards from a quote, story, success, person, historical moment, thought experiment, or mindful movement.
            </p>

            <div className="mt-10 border-t border-neutral-900 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">0 / Your brand <span className="font-normal tracking-normal">(optional)</span></div>
              {profileLocked && !editingProfile ? (
                <div className="mt-4 flex items-center justify-between rounded-lg border border-neutral-200 bg-white/60 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-xs font-semibold text-white">
                      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initial(name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{name}</div>
                      <div className="truncate text-xs text-neutral-500">{handle}</div>
                    </div>
                    <span className="text-xs font-medium text-green-700">✓ Saved</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingProfile(true)}
                    className="ml-4 shrink-0 text-xs font-semibold text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                <>
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
                      {profileSaving ? "Saving..." : "Save brand profile"}
                    </button>
                    <span className="text-[11px] text-neutral-400">Used on your PostCards and remembered for future cards.</span>
                  </div>
                </>
              )}
              {profileMessage && <div className="mt-3 text-[11px] text-neutral-500">{profileMessage}</div>}
            </div>

            <div className="mt-10 border-t border-neutral-900 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">1 / Choose a format</div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {templates.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setTemplate(item.id);
                      setGenerateMessage("");
                      setSaved(false);
                      setSavedCardId(null);
                      setHeadline("");
                      setBody("");
                      setClosing("");
                      setQuoteHash(null);
                      setQuoteAuthor("");
                      setStoryHash(null);
                      setStorySourceName("");
                      setStorySourceTitle("");
                      setStorySourceUrl("");
                      setStoryCategory("");
                      setSource(
                        item.id === "quote"
                          ? "Inspirational quotes provided by ZenQuotes API"
                          : item.id === "story"
                            ? "Motivational story source"
                            : "Source: PostCard"
                      );
                    }}
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
              <p className="mt-2 text-center text-[11px] text-neutral-400">Quotes use curated feeds; stories use source material; factual formats should be verified before publishing.</p>
            </div>

            <div className="mt-10 border-t border-neutral-300 pt-7">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">2 / Write the card</div>

              {template === "quote" ? (
                <div className="mt-5 space-y-5">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Motivational field</span>
                    <select value={quoteField} onChange={(e) => setQuoteField(e.target.value as (typeof quoteFields)[number])} className="mt-2 w-full border-b border-neutral-300 bg-transparent px-0 py-2 text-sm outline-none focus:border-neutral-900">
                      {quoteFields.map((field) => <option key={field} value={field}>{field.charAt(0).toUpperCase() + field.slice(1)}</option>)}
                    </select>
                  </label>
                  <Field label="Quote" value={headline} onChange={setHeadline} textarea />
                  <Field label="Author" value={body.replace(/^—\s*/, "")} onChange={(value) => { setBody(value ? `— ${value}` : ""); setQuoteAuthor(value); }} />
                  <p className="text-[11px] leading-5 text-neutral-500">Quotes come from an external feed. Once you save or publish one, it is excluded from your future selections for 90 days.</p>
                </div>
              ) : template === "story" ? (
                <div className="mt-5 space-y-5">
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Story field</span>
                    <select
                      value={storyCategory || "resilience"}
                      onChange={(e) => setStoryCategory(e.target.value)}
                      className="mt-2 w-full border-b border-neutral-300 bg-transparent px-0 py-2 text-sm outline-none focus:border-neutral-900"
                    >
                      {["resilience", "courage", "discipline", "leadership", "entrepreneurship", "learning", "life", "achievement", "sports"].map((field) => (
                        <option key={field} value={field}>{field.charAt(0).toUpperCase() + field.slice(1)}</option>
                      ))}
                    </select>
                  </label>
                  <Field label="Story title" value={headline} onChange={setHeadline} />
                  <Field label="Story" value={body} onChange={setBody} textarea />
                  <Field label="Lesson" value={closing} onChange={setClosing} textarea />
                  <p className="text-[11px] leading-5 text-neutral-500">
                    PostCard reads current RSS feed items, then creates an original short story from the source material. The same source story is excluded for you for 90 days after saving.
                  </p>
                  {storySourceName && (
                    <p className="text-[11px] leading-5 text-neutral-500">
                      Source material: <span className="font-medium text-neutral-700">{storySourceName}</span>
                      {storySourceUrl ? <> · <a href={storySourceUrl} target="_blank" rel="noreferrer" className="underline">open source</a></> : null}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-5 space-y-5">
                  <Field
                    label={template === "success" ? "Story title" : template === "person" ? "Person" : template === "history" ? "Historical moment" : template === "thought" ? "Thought experiment" : "Mindful movement"}
                    value={headline}
                    onChange={setHeadline}
                  />
                  <Field
                    label={template === "success" ? "Story" : template === "person" ? "Why this person matters" : template === "history" ? "What happened" : template === "thought" ? "Explore the idea" : "Practice"}
                    value={body}
                    onChange={setBody}
                    textarea
                  />
                  <Field
                    label={template === "success" ? "Lesson" : template === "person" ? "Takeaway" : template === "history" ? "Why it matters today" : template === "thought" ? "Question to leave with the reader" : "Reflection"}
                    value={closing}
                    onChange={setClosing}
                    textarea
                  />
                  <p className="text-[11px] leading-5 text-neutral-500">
                    Generate creates a fresh version for this format. For people and historical moments, verify factual details before publishing.
                  </p>
                </div>

                <div className="mt-5 space-y-5">
                  <Field label="Main thought" value={headline} onChange={setHeadline} textarea />
                  <p className="text-[11px] leading-5 text-neutral-500">
                    Supporting thought and closing line are generated automatically and used in the PostCard layout.
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
              {savedCardId && (
                <>
                  <Link href={`/postcard/${savedCardId}`} className="border-b border-neutral-900 pb-1 text-xs font-medium">Open this card →</Link>
                  <Link href="/postcard/saved" className="border-b border-neutral-500 pb-1 text-xs font-medium text-neutral-600 hover:text-neutral-900">Open all saved cards →</Link>
                </>
              )}
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
              <Link href="/postcard/saved" className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-xs font-semibold text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900">📁 Saved PostCards</Link>
              <span className="text-xs text-neutral-500">1080 × 1080 · Square social card</span>
              {(linkedinMessage || linkedinNotice) && <span className="w-full text-xs text-neutral-600">{linkedinMessage || linkedinNotice}</span>}
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
