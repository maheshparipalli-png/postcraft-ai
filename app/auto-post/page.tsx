"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type VisualCopy = {
  headline: string;
  body: string;
  attribution: string;
};

type Preview = {
  article: {
    title: string;
    source: string;
    publishedAt?: string;
    url: string;
  };
  angle?: { angle: string; why?: string };
  post: string;
  visual?: VisualCopy;
  ranking?: { candidateCount?: number; reason?: string };
};

type PublishFormat = "combined" | "text" | "image";

const STORAGE_KEY = "postcraft-active-daily-draft";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cleanVisualText(value: string) {
  return value
    .replace(/’/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”/g, "-")
    .replace(/.../g, "...")
    .replace(/Â/g, "")
    .replace(/\uFEFF/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?;:])/g, "$1")
    .trim();
}

function formatAttributionDate(value?: string) {
  if (!value) return "date unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "date unavailable";

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function wrapText(
  text: string,
  maxWidth: number,
  fontSize: number,
  fontFamily: string,
  fontWeight: number,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return text.split(/\n+/).flatMap((paragraph) =>
      paragraph.trim().split(/\s+/).filter(Boolean),
    );
  }

  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;

  const lines: string[] = [];

  for (const paragraph of text.split(/\n+/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;

      if (line && context.measureText(candidate).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) {
      lines.push(line);
    }
  }

  return lines;
}
function fallbackVisual(preview: Preview): VisualCopy {
  const text = preview.post
    .replace(/^This post is based on[^\n]*\n*/i, "")
    .trim();
  const firstSentence =
    text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim() ||
    "A useful point of view on AI and technology.";
  const body = text === firstSentence ? "" : text.replace(firstSentence, "").trim();

  return {
    headline: firstSentence.replace(/[.!?]+$/, ""),
    body: body.length > 280 ? `${body.slice(0, 277).trim()}...` : body,
    attribution: `Based on a ${preview.article.source} article, ${formatAttributionDate(preview.article.publishedAt)}`,
  };
}

async function renderVisual(visual: VisualCopy) {
  const width = 1080;
  const margin = 72;

  const headlineLines = wrapText(visual.headline, width - margin * 2, 42, "Georgia", 700);
  const bodyLines = wrapText(visual.body, width - margin * 2, 31, "Georgia", 400);

  const headlineLineHeight = 52;
  const bodyLineHeight = 43;
  const headlineStartY = 205;

  const bodyStartY =
    headlineStartY +
    headlineLines.length * headlineLineHeight +
    70;

  const bodyEndY =
    bodyLines.length > 0
      ? bodyStartY + (bodyLines.length - 1) * bodyLineHeight
      : bodyStartY;

  const sourceDividerY = bodyEndY + 55;
  const sourceY = sourceDividerY + 32;
  const footerY = sourceY + 48;
  const height = footerY + 42;

  const headlineSvg = headlineLines
    .map(
      (line, index) =>
        `<text x="${margin}" y="${headlineStartY + index * headlineLineHeight}" font-family="Georgia, serif" font-size="42" font-weight="700" fill="#f5f5f5">${escapeXml(line)}</text>`,
    )
    .join("");

  const bodySvg = bodyLines
    .map(
      (line, index) =>
        `<text x="${margin}" y="${bodyStartY + index * bodyLineHeight}" font-family="Georgia, serif" font-size="31" font-weight="400" fill="#e7e5e4">${escapeXml(line)}</text>`,
    )
    .join("");

  const svg = `<svg
    xmlns="http://www.w3.org/2000/svg"
    width="${width}"
    height="${height}"
    viewBox="0 0 ${width} ${height}"
  >
    <rect width="100%" height="100%" fill="#171717"/>

    <text
      x="${margin}"
      y="82"
      font-family="Arial, sans-serif"
      font-size="16"
      letter-spacing="4"
      fill="#a3a3a3"
    >POSTCRAFT · LINKEDIN VISUAL</text>

    ${headlineSvg}
    ${bodySvg}

    <line
      x1="${margin}"
      y1="${sourceDividerY}"
      x2="${width - margin}"
      y2="${sourceDividerY}"
      stroke="#3f3f46"
      stroke-width="1"
    />

    <text
      x="${margin}"
      y="${sourceY}"
      font-family="Arial, sans-serif"
      font-size="18"
      fill="#a3a3a3"
    >${escapeXml(visual.attribution)}</text>

    <text
      x="${margin}"
      y="${footerY}"
      font-family="Arial, sans-serif"
      font-size="16"
      fill="#737373"
    >A considered point of view, prepared with PostCraft AI</text>
  </svg>`;

  const image = new Image();
  image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () =>
      reject(new Error("Could not render the visual post."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Your browser could not create the visual post.");
  }

  context.drawImage(image, 0, 0);

  return canvas.toDataURL("image/png");
}
export default function AutoPostPage() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [publishStatus, setPublishStatus] = useState("");
  const [published, setPublished] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [format, setFormat] = useState<PublishFormat>("combined");
  const [visualUrl, setVisualUrl] = useState("");
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const response = await fetch("/api/auto-post/draft", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        if (data?.draft?.generated_post) {
          setPreview({
            article: {
              title: data.draft.source_title,
              source: data.draft.source_name || "Unknown source",
              url: data.draft.source_url,
              publishedAt: data.draft.created_at,
            },
            angle: {
              angle: data.draft.recommended_angle || "",
              why: data.draft.angle_why || "",
            },
            post: data.draft.working_post || data.draft.generated_post,
            ranking: {
              candidateCount: data.draft.candidate_count || undefined,
              reason: data.draft.ranking_reason || undefined,
            },
          });
          setPublished(data.draft.status === "published");
          setHydrated(true);
          return;
        }
      } catch {
        // Fall back to the local browser draft.
      }

      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setPreview(JSON.parse(saved));
      } catch {
        // Ignore malformed local storage data.
      }
      setHydrated(true);
    })();
  }, []);

  async function prepareDraft(force = false) {
    if (preview && !published && !force) return;
    setRunning(true);
    setError("");
    setVisualUrl("");
    setPublishStatus("");

    try {
      const response = await fetch("/api/auto-publish/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: "AI & Technology" }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "The draft could not be prepared.");

      const saveResponse = await fetch("/api/auto-post/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: data, replace: force }),
      });
      const savedData = await saveResponse.json().catch(() => null);
      if (!saveResponse.ok) throw new Error(savedData?.error || "The draft could not be saved.");

      setPreview(data);
      setPublished(false);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while preparing the draft.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    if (hydrated && !preview) void prepareDraft();
  }, [hydrated]);

  async function regenerateDraft() {
    if (published || running) return;
    const confirmed = window.confirm("Regenerate today’s draft? The current unsent draft will be replaced.");
    if (confirmed) await prepareDraft(true);
  }

  async function selectFormat(next: PublishFormat) {
    setFormat(next);
    setError("");
    if ((next === "combined" || next === "image") && preview && !visualUrl) {
      setRendering(true);
      try {
        setVisualUrl(await renderVisual(preview.visual || fallbackVisual(preview)));
      } catch (err) {
        setFormat("text");
        setError(err instanceof Error ? err.message : "Could not render the visual post.");
      } finally {
        setRendering(false);
      }
    }
  }

  async function copyPost() {
    if (!preview?.post) return;
    try {
      await navigator.clipboard.writeText(preview.post);
      setCopyStatus("Copied");
      window.setTimeout(() => setCopyStatus(""), 2000);
    } catch {
      setCopyStatus("Copy failed");
    }
  }

  async function publishPost() {
    if (!preview || published || publishStatus === "Publishing...") return;
    setPublishStatus("Publishing...");
    setError("");

    try {
      const imageDataUrl =
        format === "text"
          ? undefined
          : visualUrl || await renderVisual(preview.visual || fallbackVisual(preview));

      const response = await fetch("/api/linkedin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceUrl: preview.article.url,
          sourceTitle: preview.article.title,
          commentary: preview.post,
          imageDataUrl,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "The post could not be published.");

      setPublished(true);
      setPublishStatus("Published");
      await fetch("/api/auto-post/draft", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "published", linkedinPostId: data?.id || data?.postId || "" }),
      });
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      setPublishStatus("");
      setError(err instanceof Error ? err.message : "The post could not be published.");
    }
  }

  const visual = preview ? preview.visual || fallbackVisual(preview) : null;
  const statusLabel = running ? "Regenerating draft..." : published ? "Published" : preview ? "Ready for review" : "Preparing draft...";
  const statusClass = running
    ? "bg-blue-100 text-blue-800"
    : published
      ? "bg-blue-100 text-blue-800"
      : "bg-emerald-100 text-emerald-800";

  return (
    <main className="min-h-screen bg-[#f4f3ef] text-[#171717]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-neutral-300/80 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-serif text-2xl font-semibold tracking-[-0.04em]">POSTCRAFT</span>
            <span className="hidden border-l border-neutral-300 pl-3 text-[10px] uppercase tracking-[0.18em] text-neutral-500 sm:inline">AI editorial automation</span>
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs" aria-label="Main navigation">
            {[["Home", "/"], ["Write", "/create"], ["Auto-post", "/auto-post"], ["Auto-publish", "/auto-publish"], ["CommentCraft", "/commentcraft/import"], ["Workspace", "/workspace"], ["Billing", "/billing"]].map(([label, href]) => (
              <Link key={href} href={href} className={label === "Auto-post" ? "font-medium text-neutral-900" : "text-neutral-500 hover:text-neutral-900"}>{label}</Link>
            ))}
          </nav>
        </header>

        <section className="border-b border-neutral-300/80 py-12 lg:py-16">
          <div className="mb-4 text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Create · AI-assisted editorial workflow</div>
          <h1 className="max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.05em] sm:text-7xl">Your next useful post,<br />prepared for you.</h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600">Discover a verified AI story, choose a useful perspective, and review a LinkedIn-ready draft before publishing.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button type="button" onClick={() => void prepareDraft()} disabled={running || (!!preview && !published)} className="bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400">{running ? "Regenerating draft..." : preview && !published ? "Draft ready" : "Prepare today’s post →"}</button>
            {preview && !published && <button type="button" onClick={() => void regenerateDraft()} disabled={running} className="border border-neutral-300 bg-white/50 px-5 py-3 text-sm disabled:opacity-50">Regenerate draft</button>}
            <Link href="/create" className="border border-neutral-300 bg-white/50 px-5 py-3 text-sm">Write manually</Link>
          </div>
        </section>

        <section className="grid gap-8 border-b border-neutral-300/80 py-10 lg:grid-cols-[280px_1fr]">
          <aside className="space-y-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">How it works</div>
              <p className="mt-3 text-sm leading-6 text-neutral-600">Auto-post prepares one draft for your review. You can regenerate an unsent draft, then choose text, visual, or one combined LinkedIn post containing both.</p>
            </div>
            <div className="border-t border-neutral-300 pt-5 text-xs leading-6 text-neutral-500"><strong className="text-neutral-900">Next step:</strong><br /><Link href="/auto-publish" className="underline underline-offset-4">Configure daily automation →</Link></div>
          </aside>

          <div className="min-w-0">
            <div className="flex items-end justify-between gap-4 border-b border-neutral-300 pb-5">
              <div>
                <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Today’s recommendation</div>
                <h2 className="mt-2 font-serif text-3xl tracking-[-0.03em] sm:text-4xl">One story. One clear point.</h2>
              </div>
              <span className={`rounded-full px-3 py-1 text-[10px] font-medium ${statusClass}`}>{statusLabel}</span>
            </div>

            {error && <div className="mt-6 border border-red-200 bg-red-50 p-5 text-sm text-red-800"><div className="font-medium">We couldn’t complete the action.</div><p className="mt-1 leading-6">{error}</p></div>}

            {running && <div className="mt-6 border border-blue-200 bg-blue-50/70 p-5 text-sm text-blue-900"><div className="font-medium">Regenerating draft...</div><p className="mt-1 leading-6">Your current review is being replaced with a new recommendation. This may take a few moments. Your review will be ready shortly.</p></div>}

            {!preview && !running && <div className="mt-6 border border-neutral-300 bg-white/60 p-8"><div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Preparing your draft</div><h3 className="mt-5 font-serif text-3xl">Finding today’s strongest AI story...</h3><p className="mt-3 text-sm leading-6 text-neutral-600">PostCraft is checking current sources, selecting a useful angle, and generating a LinkedIn-ready post.</p></div>}

            {preview && !running && <div className="mt-6 space-y-6">
              <div className={`flex flex-wrap items-center justify-between gap-3 border p-4 text-sm ${published ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
                <span><strong>{published ? "Published." : "Draft ready for review."}</strong> {published ? "This post has already been published." : "You can regenerate it before publishing."}</span>
                {!published && <button type="button" onClick={() => void regenerateDraft()} disabled={running} className="font-medium underline underline-offset-4 disabled:opacity-50">Regenerate</button>}
              </div>

              <article className="border border-neutral-300 bg-white/70 p-6 sm:p-8">
                <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-neutral-500"><span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">Verified source</span><span>{preview.article.source}</span><span>·</span><span>{preview.article.publishedAt || "Date unavailable"}</span></div>
                <h3 className="mt-5 max-w-3xl font-serif text-3xl leading-tight sm:text-4xl">{preview.article.title}</h3>
                {preview.ranking?.reason && <p className="mt-4 max-w-2xl text-sm leading-6 text-neutral-600">{preview.ranking.reason}</p>}
                <a href={preview.article.url} target="_blank" rel="noreferrer" className="mt-5 inline-block text-xs font-medium underline underline-offset-4">Read original source →</a>
              </article>

              <div className="border border-neutral-300 bg-white/70 p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Publishing format</div><p className="mt-1 text-sm text-neutral-600">Choose how this single LinkedIn post should appear.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void selectFormat("combined")} className={`border px-4 py-2 text-sm ${format === "combined" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}>Text + visual</button><button type="button" onClick={() => void selectFormat("text")} className={`border px-4 py-2 text-sm ${format === "text" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}>Text only</button><button type="button" onClick={() => void selectFormat("image")} className={`border px-4 py-2 text-sm ${format === "image" ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 bg-white"}`}>Visual only</button></div></div>

                {format !== "text" && <div className="mt-6 max-w-[540px] overflow-hidden border border-neutral-300 bg-[#171717]">{rendering ? <div className="flex aspect-[4/5] items-center justify-center text-sm text-neutral-300">Preparing visual...</div> : visualUrl ? <img src={visualUrl} alt="Generated LinkedIn visual preview" className="block h-auto w-full" /> : <div className="p-8 text-sm text-neutral-500">Select a visual format to preview the image.</div>}</div>}
                {format !== "image" && <div className="mt-6 max-w-2xl whitespace-pre-wrap border-t border-neutral-300 pt-6 text-[15px] leading-7 text-neutral-700">{preview.post}</div>}

                <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => void publishPost()} disabled={published || !!running || !!rendering} className="bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-400">{publishStatus || (published ? "Published" : "Publish to LinkedIn →")}</button><button type="button" onClick={() => void copyPost()} className="border border-neutral-300 bg-white px-5 py-3 text-sm">{copyStatus || "Copy text"}</button></div>
              </div>
            </div>}
          </div>
        </section>
      </div>
    </main>
  );
}






