"use client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignOutButton from "./SignOutButton";

type Idea = { title: string; description: string; whyItMatters: string; sourceIndexes: number[]; source: string; url: string; publishedAt: string };
type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type AngleSuggestion = { text: string; why: string; evidence: string };
type Perspective = "agree" | "disagree" | "mixed" | "curious";

const topics = ["AI & Technology"];
const perspectives: { id: Perspective; label: string; description: string }[] = [
  { id: "agree", label: "I agree", description: "Build on the argument." },
  { id: "disagree", label: "I disagree", description: "Challenge the argument." },
  { id: "mixed", label: "It is more complicated", description: "Add a missing distinction." },
  { id: "curious", label: "I am not sure yet", description: "Explore the unresolved question." },
];

function formatDateInput(value: string) {
  if (!value) return "";
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatPublishedAtIST(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date) + " IST";
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x60;/gi, "`")
    .replace(/&#x3D;/gi, "=")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanGeneratedPost(value: string) {
  return value.replace(/^```(?:text|markdown|json)?\s*/i, "").replace(/\s*```$/i, "").replace(/^\s*(LinkedIn post|Post):\s*/i, "").trim();
}

function isUnsupportedAngle(item: AngleSuggestion) {
  const text = `${item.text} ${item.why}`.toLowerCase();
  return [
    "cover-up",
    "cover up",
    "downplaying",
    "concealing",
    "deception",
    "self-aware",
    "self aware",
    "take control",
    "taking control",
    "took control",
    "becoming self-aware",
    "becoming self aware",
    "out-of-control",
    "out of control",
    "may have been aware",
    "was aware",
    "lack of transparency",
    "not transparent",
    "intentional",
    "deliberately",
    "secretly",
    "rogue ai",
  ].some((phrase) => text.includes(phrase));
}

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("AI & Technology");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [angle, setAngle] = useState("");
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [openingSavedPost, setOpeningSavedPost] = useState(false);
  const [postTitle, setPostTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [newsTitle, setNewsTitle] = useState("");
  const [newsSource, setNewsSource] = useState("");
  const [newsDate, setNewsDate] = useState("");
  const [suggestedAngles, setSuggestedAngles] = useState<AngleSuggestion[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [perspective, setPerspective] = useState<Perspective>("mixed");
  const [perspectiveNote, setPerspectiveNote] = useState("");
  const [post, setPost] = useState("");
  const [copied, setCopied] = useState(false);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState("");
  const [linkedinDisconnecting, setLinkedinDisconnecting] = useState(false);
  const [originalityStatus, setOriginalityStatus] = useState<"idle" | "checking" | "clear" | "duplicate">("idle");
  const [originalityMessage, setOriginalityMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [angleLoading, setAngleLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [sourceVerifying, setSourceVerifying] = useState(false);
  const [sourceVerified, setSourceVerified] = useState(false);
  const [error, setError] = useState("");
  const angleRequestRef = useRef(0);
  const angleAbortRef = useRef<AbortController | null>(null);

  // URL callback parameters and saved-post hydration are intentionally handled after mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connectedMessage = params.get("linkedinConnected") === "1" ? "LinkedIn connected. You can publish your post now." : "";
    const errorMessage = params.get("linkedinError") || "";
    const statusPromise = fetch("/api/linkedin/status").then((response) => response.json());
    if (!params.get("postId")) {
      void discoverIdeas();
    }
    Promise.resolve().then(() => {
      if (connectedMessage) setLinkedinMessage(connectedMessage);
      if (errorMessage) setLinkedinMessage(errorMessage);
    });
    statusPromise.then((data) => setLinkedinConnected(Boolean(data?.connected))).catch(() => undefined);

    const postId = params.get("postId");
    if (!postId) return;

    let cancelled = false;
    async function loadSavedPost() {
      try {
        const supabase = createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Please sign in to open this post.");

        const { data, error: postError } = await supabase
          .from("posts")
          .select("id,title,content,topic,source_url,angle,tone")
          .eq("id", postId)
          .eq("user_id", user.id)
          .single();

        if (postError) throw postError;
        if (cancelled || !data) return;

        setEditingPostId(data.id);
        setPostTitle(data.title || "");
        setSourceUrl(data.source_url || "");
        setPost(data.content || "");
        setTopic(data.topic || "AI & Technology");
        setAngle(data.angle || "");
        if (data.tone === "agree" || data.tone === "disagree" || data.tone === "mixed" || data.tone === "curious") {
          setPerspective(data.tone);
        }
        setSaveMessage("Saved post loaded. You can edit it below.");
        window.history.replaceState({}, "", "/");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load the saved post.");
          setOpeningSavedPost(false);
        }
      }
    }

    loadSavedPost();
    return () => { cancelled = true; };
  }, []);
function resetFromStory() {
    setAngle("");
    setSuggestedAngles([]);
    setEvidence([]);
    setPerspective("mixed");
    setPerspectiveNote("");
    setPost("");
    setCopied(false);
    setNewsTitle("");
    setNewsSource("");
    setNewsDate("");
    setSourceVerified(false);
    setSourceVerifying(false);
  }

  async function discoverIdeas() {
    setLoading(true);
    setError("");
    setIdeas([]);
    setSelectedIdea(null);
    resetFromStory();
    try {
      const selectedTopic = topic;
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: selectedTopic }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Discovery failed");
      setIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }

  async function verifySource(idea: Idea) {
    setSourceVerifying(true);
    setSourceVerified(false);
    setError("");

    try {
      const response = await fetch("/api/verify-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: idea.url }),
      });

      const data = await response.json();

      if (!response.ok || !data?.verified) {
        throw new Error(
          data?.error ||
            "PostCraft could not verify the original news source.",
        );
      }

      setNewsTitle(
        typeof data.title === "string" && data.title.trim()
          ? data.title.trim()
          : idea.title,
      );

      setNewsSource(
        typeof data.source === "string" && data.source.trim()
          ? data.source.trim()
          : idea.source,
      );

      setNewsDate(
        typeof data.publishedAt === "string" && data.publishedAt.trim()
          ? formatDateInput(data.publishedAt)
          : formatDateInput(idea.publishedAt),
      );

      setSourceVerified(true);
      return true;
    } catch (err) {
      setSourceVerified(false);
      setError(
        err instanceof Error
          ? err.message
          : "PostCraft could not verify the original news source.",
      );
      return false;
    } finally {
      setSourceVerifying(false);
    }
  }
  async function selectIdea(idea: Idea) {
    const requestId = ++angleRequestRef.current;
    angleAbortRef.current?.abort();

    const controller = new AbortController();
    angleAbortRef.current = controller;

    setSelectedIdea(idea);
    resetFromStory();
    setNewsTitle(decodeHtmlEntities(idea.title));
    setNewsSource(decodeHtmlEntities(idea.source));
    setNewsDate(formatDateInput(idea.publishedAt));
    setError("");

    const verified = await verifySource(idea);

    if (!verified || requestId !== angleRequestRef.current) {
      return;
    }

    setAngleLoading(true);

    try {
      const selectedTopic = topic;
      const prompt = `You are PostCraft AI, an editorial thinking partner. Analyze only this exact news story information and find thoughtful, evidence-led LinkedIn angles. Do not search the internet and do not rely on outside knowledge.\n\nTopic: ${selectedTopic}\nNews title: ${idea.title}\nNews source: ${idea.source}\nNews date: ${formatDateInput(idea.publishedAt) || "Unknown"}\nURL: ${idea.url}\nSummary: ${idea.description || "No reliable summary was supplied."}\n\nEvery angle must be directly supported by the headline or summary. Do not infer motives, cover-ups, awareness, deception, self-awareness, autonomous control, causation, or consequences that the supplied information does not establish. If the evidence is limited, produce a cautious angle about what is known, what is unknown, or what the timeline shows. Return ONLY valid JSON. The system will return the strongest three grounded angles.`;
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "angles", prompt }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Angle generation failed");
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.text);
      } catch {
        const match = String(data.text).match(/\[[\s\S]*\]/);
        if (!match) throw new Error("PostCraft could not finish thinking about this story. Try another story.");
        parsed = JSON.parse(match[0]);
      }
      const generatedAngles: AngleSuggestion[] = Array.isArray(parsed)
        ? parsed.map((item): AngleSuggestion | null => {
            if (!item || typeof item !== "object") return null;
            const value = item as { angle?: unknown; why?: unknown; evidence?: unknown };
            const text = typeof value.angle === "string" ? value.angle.trim() : "";
            const why = typeof value.why === "string" ? value.why.trim() : "";
            const evidenceAnchor = typeof value.evidence === "string" ? value.evidence.trim() : "";
            return text ? { text, why, evidence: evidenceAnchor } : null;
          }).filter((item): item is AngleSuggestion => Boolean(item?.text))
        : [];
      const uniqueAngles = Array.from(new Map(generatedAngles.filter((item) => !isUnsupportedAngle(item)).map((item) => [item.text.toLowerCase(), item])).values()).slice(0, 3);
      if (!uniqueAngles.length) throw new Error("PostCraft could not find a useful angle for this story. Try another story.");
      if (requestId !== angleRequestRef.current) return;
      setEvidence(Array.isArray(data?.evidence) ? data.evidence : []);
      setSuggestedAngles(uniqueAngles);

      if (uniqueAngles.length === 1) {
        setAngle(uniqueAngles[0].text);
        void createPost(uniqueAngles[0].text, true);
      } else {
        setAngle("");
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      if (requestId === angleRequestRef.current) setError(err instanceof Error ? err.message : "PostCraft could not finish thinking about this story. Try another story.");
    } finally {
      if (requestId === angleRequestRef.current) setAngleLoading(false);
    }
  }

  async function createPost(nextAngle?: string, sourceIsVerified = sourceVerified) {
    const selectedAngleText = nextAngle ?? angle;
    if (!selectedIdea || !selectedAngleText || !sourceIsVerified) {
      setError("Verify the original news source before creating the post.");
      return;
    }
    setPostLoading(true);
    setError("");
    setCopied(false);
    const selectedAngle = suggestedAngles.find((item) => item.text === selectedAngleText);
    const selectedPerspective = perspectives.find((item) => item.id === perspective);
    const selectedTopic = topic;
    const prompt = `You are PostCraft AI, an editorial thinking partner. Turn ONE news development, ONE selected angle, and the user's point of view into a LinkedIn post.\n\nTopic: ${selectedTopic}\nNews title: ${newsTitle || selectedIdea.title}\nNews source: ${newsSource || selectedIdea.source}\nNews date: ${newsDate || "Unknown"}\nHeadline: ${newsTitle || selectedIdea.title}\nSource: ${newsSource || selectedIdea.source}\nURL: ${selectedIdea.url}\nSummary: ${selectedIdea.description || "No reliable summary was supplied."}\nSelected angle: ${selectedAngleText}\nWhy this angle works: ${selectedAngle?.why || "It gives the story a specific point of view."}\nUser perspective: ${selectedPerspective?.label}\nPerspective guidance: ${selectedPerspective?.description}\nUser's own note: ${perspectiveNote || "No additional note supplied."}\nEvidence JSON: ${JSON.stringify(evidence)}\n\nThe evidence JSON above is the complete factual source. Do not search the internet. Do not add outside facts, personal experience, statistics, motives, or examples. Keep the selected angle intact. Make the thesis clear early. Use plain language and natural sentence rhythm. Avoid generic phrases such as "raises important questions", "future of work", "need to strike a balance", or "in today's rapidly changing world". Do not add a generic policy conclusion.

Do not include a source title, publication name, or publication date in your response.
The application will append the verified source details separately.
Return ONLY the finished LinkedIn post body.`;
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post", prompt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Post generation failed");
      const generatedPost = cleanGeneratedPost(typeof data?.text === "string" ? data.text : "");
      if (!generatedPost) throw new Error("PostCraft could not create the post. Please try again.");
      let value = generatedPost;
      try {
        const parsed = JSON.parse(generatedPost);
        if (typeof parsed?.post === "string") value = parsed.post.trim();
      } catch {
        // Plain-text response is expected.
      }
      const sourceTitle = (newsTitle || selectedIdea.title).trim();
      const sourcePublication = (newsSource || selectedIdea.source).trim();
      const sourceDate = newsDate
      ? formatDate(`${newsDate}T00:00:00`)
        : "Unknown date";

      const sourceAttribution = `This post is based on an article published by ${sourcePublication} on ${sourceDate}, titled "${sourceTitle}".`;

      setPost(`${sourceAttribution}\n\n${value.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PostCraft could not create the post. Please try again.");
    } finally {
      setPostLoading(false);
    }
  }

  function connectLinkedIn() {
    router.push("/api/linkedin/connect");
  }

  async function disconnectLinkedIn() {
    if (!window.confirm("Disconnect LinkedIn from PostCraft?")) return;

    setLinkedinDisconnecting(true);
    setLinkedinMessage("");

    try {
      const response = await fetch("/api/linkedin/disconnect", { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data?.disconnected) {
        throw new Error(data?.error || "Could not disconnect LinkedIn.");
      }

      setLinkedinConnected(false);
      setLinkedinMessage("LinkedIn disconnected from PostCraft.");
    } catch (err) {
      setLinkedinMessage(err instanceof Error ? err.message : "Could not disconnect LinkedIn.");
    } finally {
      setLinkedinDisconnecting(false);
    }
  }

  async function checkOriginality(text = post) {
    if (!text.trim()) {
      setOriginalityStatus("idle");
      setOriginalityMessage("");
      return false;
    }
    setOriginalityStatus("checking");
    setOriginalityMessage("Checking against previously published content...");
    try {
      const response = await fetch("/api/linkedin/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commentary: text.trim(), sourceUrl: selectedIdea?.url || sourceUrl || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not complete the originality check.");
      const duplicate = Boolean(data?.duplicate);
      setOriginalityStatus(duplicate ? "duplicate" : "clear");
      setOriginalityMessage(duplicate ? (data.message || "Similar content has already been published.") : "No matching published article or identical post was found.");
      return !duplicate;
    } catch (err) {
      setOriginalityStatus("idle");
      setOriginalityMessage(err instanceof Error ? err.message : "Could not complete the originality check.");
      return false;
    }
  }

  async function publishToLinkedIn() {
    const savedPostId = await savePost();

    if (!savedPostId) {
      setLinkedinMessage("Please save the post before publishing.");
      return;
    }
    if (!post.trim() || originalityStatus === "duplicate") return;
    setLinkedinLoading(true);
    setLinkedinMessage("");
    try {
      const response = await fetch("/api/linkedin/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: savedPostId,
          commentary: post.trim(),
          sourceUrl: selectedIdea?.url || null,
          sourceTitle: decodeHtmlEntities(selectedIdea?.title || newsTitle || ""),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Could not publish to LinkedIn.");
      setLinkedinMessage("Published to your LinkedIn profile.");
      router.push("/workspace");
    } catch (err) {
      setLinkedinMessage(err instanceof Error ? err.message : "Could not publish to LinkedIn.");
    } finally {
      setLinkedinLoading(false);
    }
  }

  useEffect(() => {
    if (!post.trim()) { setOriginalityStatus("idle"); setOriginalityMessage(""); return; }
    const timer = window.setTimeout(() => { void checkOriginality(post); }, 500);
    return () => window.clearTimeout(timer);
  }, [post, selectedIdea?.url]);

  async function copyPost() {
    if (!post) return;
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the post to your clipboard.");
    }
  }

  if (openingSavedPost) {
    return (
      <main className="min-h-screen bg-[#f7f6f2] text-[#171717] selection:bg-neutral-900 selection:text-white">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7">
            <div>
              <div className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCRAFT</div>
              <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">AI editorial studio</div>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/auto-post" className="text-neutral-500 transition hover:text-neutral-900">Auto-post</Link>
              <Link href="/commentcraft/import" className="text-neutral-500 transition hover:text-neutral-900">CommentCraft</Link>
            <Link href="/workspace" className="text-xs text-neutral-500 transition hover:text-neutral-900">
                ------- Workspace
              </Link>
              {linkedinConnected ? (
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
                    LinkedIn connected
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-lg">
                    <div className="font-medium text-neutral-900">LinkedIn account connected</div>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">PostCraft can publish posts to your LinkedIn profile.</p>
                    <button
                      type="button"
                      onClick={disconnectLinkedIn}
                      disabled={linkedinDisconnecting}
                      className="mt-3 w-full rounded-lg border border-red-200 px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {linkedinDisconnecting ? "Disconnecting..." : "Disconnect LinkedIn"}
                    </button>
                  </div>
                </details>
              ) : (
                <button type="button" onClick={connectLinkedIn} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                  Connect LinkedIn -
                </button>
              )}
              <SignOutButton />
            </div>
          </header>

          <section className="py-14 sm:py-20">
            <div className="max-w-4xl">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">Saved post</div>
              <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-[-0.045em] sm:text-7xl">Edit your post.</h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-neutral-600">Make the changes you want. PostCraft will update this saved post rather than creating a new one.</p>
            </div>
          </section>

          <section className="border-t border-neutral-900 py-10 sm:py-14">
            <div className="max-w-4xl">
              {postTitle && <div className="mb-8 border-b border-neutral-300/80 pb-5">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Story</div>
                <div className="mt-2 font-serif text-xl leading-7">{postTitle}</div>
              </div>}
              <label htmlFor="saved-post-editor" className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Post content</label>
              <textarea
                id="saved-post-editor"
                value={post}
                onChange={(event) => { setPost(event.target.value); setSaveMessage(""); }}
                rows={18}
                spellCheck
                autoFocus
                className="w-full resize-y border-y border-neutral-300/80 bg-transparent px-0 py-7 font-serif text-xl leading-8 tracking-[-0.01em] outline-none focus:border-neutral-900 sm:text-2xl sm:leading-9"
                aria-label="Saved post editor"
              />

              <div className="mt-7 flex flex-wrap items-center justify-between gap-5">
                <div className="flex items-center gap-5">
                  <Link href="/workspace" className="text-xs text-neutral-500 underline underline-offset-4 hover:text-neutral-900">Cancel</Link>
                  <span className="text-xs text-neutral-400">Editing this saved post</span>
                </div>
                <div className="flex items-center gap-5">
                  <button onClick={copyPost} disabled={!post.trim()} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400">{copied ? "Copied" : "Copy post -"}</button>
                  <button onClick={savePost} disabled={saveLoading || !post.trim()} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400">{saveLoading ? "Updating..." : "Update post -"}</button>
                  {linkedinConnected ? (
                    <button onClick={publishToLinkedIn} disabled={linkedinLoading || !post.trim()} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400">{linkedinLoading ? "Publishing..." : "Publish to LinkedIn -"}</button>
                  ) : (
                    <button onClick={connectLinkedIn} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2">Connect LinkedIn -</button>
                  )}
                </div>
              </div>
              {saveMessage && <div className="mt-5 text-sm text-neutral-600">{saveMessage}</div>}
              {linkedinMessage && <div className={`mt-3 text-sm ${linkedinMessage.toLowerCase().includes("failed") || linkedinMessage.toLowerCase().includes("could") || linkedinMessage.toLowerCase().includes("connect your") ? "text-red-700" : "text-neutral-600"}`}>{linkedinMessage}</div>}
              {error && <div className="mt-5 text-sm text-red-700">{error}</div>}
            </div>
          </section>

          <footer className="flex items-center justify-between border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400"><span>PostCraft AI</span><span>Saved post editor</span></footer>
        </div>
      </main>
    );
  }

  const stage = post ? 4 : angle ? 3 : selectedIdea ? 2 : ideas.length ? 1 : 0;
  const stageLabels = ["Discover", "Choose", "Take", "Write"];

  async function savePost(): Promise<string | null> {
    if (!post.trim()) {
      setSaveMessage("There is no post to save yet.");
      return null;
    }

    setSaveLoading(true);
    setSaveMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        throw new Error("Please sign in before saving a post.");
      }

      const postValues = {
        title: selectedIdea?.title ?? (postTitle.trim() || null),
        content: post.trim(),
        topic: topic || null,
        source_url: selectedIdea?.url ?? (sourceUrl.trim() || null),
        angle: angle || null,
        tone: perspective || null,
        status: "draft",
        updated_at: new Date().toISOString(),
      };

      if (editingPostId) {
        const { error } = await supabase
          .from("posts")
          .update(postValues)
          .eq("id", editingPostId)
          .eq("user_id", user.id);
        if (error) throw error;
        setSaveMessage("Post updated.");
        return editingPostId;
      } else {
        const { data: inserted, error } = await supabase
          .from("posts")
          .insert({ user_id: user.id, ...postValues })
          .select("id")
          .single();
        if (error) throw error;

        if (!inserted?.id) {
          throw new Error("Post was saved but its ID could not be retrieved.");
        }

        setEditingPostId(inserted.id);
        setSaveMessage("Post saved.");
        return inserted.id;
      }
    } catch (error) {
      const saveError = error as {
        message?: string;
        details?: string;
        hint?: string;
        code?: string;
      };

      console.error(
        "Save post -",
        JSON.stringify({
          message: String(saveError?.message ?? ""),
          details: String(saveError?.details ?? ""),
          hint: String(saveError?.hint ?? ""),
          code: String(saveError?.code ?? ""),
          raw: error instanceof Error ? error.message : error,
        })
      );

      const diagnosticMessage = [
        saveError?.message,
        saveError?.details,
        saveError?.hint,
        saveError?.code ? `Code: ${saveError.code}` : "",
      ]
        .filter(Boolean)
        .join(" | ");

      setSaveMessage(
        diagnosticMessage ||
          (error instanceof Error
            ? error.message
            : "Could not save the post. Please try again.")
      );
      return null;
    } finally {
      setSaveLoading(false);
    }
  }
  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717] selection:bg-neutral-900 selection:text-white">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-end justify-between border-b border-neutral-300/80 py-6 sm:py-7">
          <div>
            <div className="font-serif text-[22px] font-semibold tracking-[-0.03em]">POSTCRAFT</div>
            <div className="mt-0.5 text-[11px] uppercase tracking-[0.2em] text-neutral-500">AI editorial studio</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-neutral-400">{stageLabels[Math.min(stage, 3)]}</div>
            </div>
            <div className="flex items-center gap-3">
              <nav className="hidden items-center gap-3 sm:flex" aria-label="Main navigation">
                <Link href="/" className="text-xs text-neutral-500 transition hover:text-neutral-900">Home</Link>
                <Link href="/create" className="text-xs text-neutral-500 transition hover:text-neutral-900">Write</Link>
                <Link href="/auto-post" className="text-xs text-neutral-500 transition hover:text-neutral-900">Auto-post</Link>
                <Link href="/commentcraft/import" className="text-xs text-neutral-500 transition hover:text-neutral-900">CommentCraft</Link>
                <Link href="/workspace" className="text-xs text-neutral-500 transition hover:text-neutral-900">Workspace</Link>
                <Link href="/billing" className="text-xs text-neutral-500 transition hover:text-neutral-900">Billing</Link>
              </nav>
              {linkedinConnected ? (
                <details className="relative">
                  <summary className="cursor-pointer list-none rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
                    LinkedIn connected
                  </summary>
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-lg">
                    <div className="font-medium text-neutral-900">LinkedIn account connected</div>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">PostCraft can publish posts to your LinkedIn profile.</p>
                    <button
                      type="button"
                      onClick={disconnectLinkedIn}
                      disabled={linkedinDisconnecting}
                      className="mt-3 w-full rounded-lg border border-red-200 px-3 py-2 text-left text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {linkedinDisconnecting ? "Disconnecting..." : "Disconnect LinkedIn"}
                    </button>
                  </div>
                </details>
              ) : (
                <button type="button" onClick={connectLinkedIn} className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                  Connect LinkedIn -
                </button>
              )}
              <SignOutButton />
            </div>
          </div>
        </header>

        <nav className="flex items-center justify-between border-b border-neutral-200/80 py-3 text-[10px] uppercase tracking-[0.18em] text-neutral-400" aria-label="Editorial progress">
          {stageLabels.map((label, index) => {
            const current = index + 1 === Math.max(stage, 1);
            const complete = index + 1 < stage;
            return <div key={label} className={`flex items-center gap-2 ${current ? "text-neutral-900" : complete ? "text-neutral-600" : ""}`}><span className={`h-1.5 w-1.5 rounded-full ${current ? "bg-neutral-900" : complete ? "bg-neutral-500" : "bg-neutral-300"}`} />{label}</div>;
          })}
        </nav>

        <section className="py-14 sm:py-20">
          <div className="max-w-4xl">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-neutral-500">01 / Find</div>
            <h1 className="mt-5 max-w-4xl font-serif text-5xl leading-[0.98] tracking-[-0.045em] sm:text-7xl">Find something<br className="hidden sm:block" /> worth saying.</h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">Start with a story. PostCraft helps you find the interesting question inside it - before you write a word.</p>
          </div>
        </section>

        {ideas.length > 0 && <section className="border-t border-neutral-300/80 py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">02 / Choose</div>
              <h2 className="mt-2 font-serif text-2xl">The four strongest recent stories.</h2>
              <div className="mt-3 text-xs text-neutral-500">{ideas.length} stories ranked by editorial value</div>
            </div>
            <div className="divide-y divide-neutral-300/80 border-y border-neutral-300/80">
              {ideas.map((idea, index) => {
                const selected = selectedIdea?.url === idea.url;
                if (selectedIdea && !selected) return null;
                return <article
                  key={idea.url}
                  onClick={() => selectIdea(idea)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      selectIdea(idea);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`group cursor-pointer py-7 transition sm:py-8 ${selected ? "bg-white px-5 sm:px-7" : "hover:bg-white/60"}`}
                >
                  <div className="flex gap-5">
                    <div className="hidden pt-1 font-serif text-sm text-neutral-400 sm:block">0{index + 1}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">{idea.source}{idea.publishedAt ? ` - Published ${formatPublishedAtIST(idea.publishedAt)}` : ""}</div>
                      <h3 className="mt-2 max-w-3xl font-serif text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">{idea.title}</h3>
                      {idea.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{idea.description}</p>}
                      {idea.whyItMatters && <div className="mt-5 max-w-2xl border-l border-neutral-400 pl-4"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Why this is interesting</div><p className="mt-1.5 text-sm leading-6 text-neutral-800">{idea.whyItMatters}</p></div>}
                      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
                        <a href={idea.url} target="_blank" rel="noreferrer" className="text-neutral-500 underline underline-offset-4 hover:text-neutral-900">Read source</a>
                        <span className="font-medium text-neutral-900">{selected ? "Chosen" : "Explore this story -"}</span>
                      </div>
                    </div>
                  </div>
                </article>;
              })}
            </div>
          </div>
        </section>}

        {selectedIdea && <section className="border-t border-neutral-300/80 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <button
                type="button"
                onClick={() => {
                  setSelectedIdea(null);
                  setSuggestedAngles([]);
                  setAngle("");
                  setPost("");
                }}
                className="mb-8 text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
              >
                --- Back to stories
              </button>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">03 / Angle</div>
              <h2 className="mt-2 font-serif text-2xl">What&apos;s actually interesting here?</h2>
            </div>
            <div>
              <div className="max-w-2xl border-b border-neutral-300/80 pb-7">
                <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Selected story</div>
                <div className="mt-2 font-serif text-xl leading-7">{selectedIdea.title}</div>
                <div
                  className={`mt-3 inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                    sourceVerifying
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : sourceVerified
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-neutral-300 bg-neutral-50 text-neutral-500"
                  }`}
                >
                  {sourceVerifying
                    ? "Verifying original source"
                    : sourceVerified
                      ? "Source verified"
                      : "Source not verified"}
                </div>
                <p className="mt-3 max-w-xl text-xs leading-5 text-neutral-500">
                  {sourceVerifying
                    ? "Opening the original publisher page before generating any angles."
                    : sourceVerified
                      ? "The headline, publication, and date below were taken from the original source where available."
                      : "PostCraft must verify the original source before creating angles or a post."}
                </p>
                <div className="mt-6 grid gap-5 sm:grid-cols-[1fr_180px]">
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    News source
                    <input value={newsSource} onChange={(event) => setNewsSource(event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10" placeholder="Publication or source" />
                  </label>
                  <label className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    News date
                    <input type="date" value={newsDate} onChange={(event) => setNewsDate(event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10" />
                  </label>
                </div>
                <label className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                  News title
                  <input value={newsTitle} onChange={(event) => setNewsTitle(event.target.value)} className="mt-2 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-neutral-900 outline-none focus:border-neutral-900 focus:ring-1 focus:ring-neutral-900/10" placeholder="Original news headline" />
                </label>
              </div>
              {angle && !angleLoading && (
              <div className="mt-8 border-y border-neutral-300/80 py-7">
                <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Validated angle</div>
                <div className="mt-3 font-serif text-2xl leading-tight tracking-[-0.02em]">{angle}</div>
                {suggestedAngles.find((item) => item.text === angle)?.why && <p className="mt-3 text-sm leading-6 text-neutral-600">{suggestedAngles.find((item) => item.text === angle)?.why}</p>}
                {suggestedAngles.find((item) => item.text === angle)?.evidence && <p className="mt-3 text-xs leading-5 text-neutral-500"><span className="font-semibold text-neutral-700">Evidence anchor:</span> {suggestedAngles.find((item) => item.text === angle)?.evidence}</p>}
                {!post && <button type="button" onClick={() => void createPost(angle)} disabled={postLoading || !sourceVerified} className="mt-5 border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400">Create post from this angle -</button>}
              </div>
            )}

            {!post && !postLoading && !angleLoading && suggestedAngles.length > 0 && (
              <div className="mt-8">
                <div className="mb-4 text-[10px] uppercase tracking-[0.15em] text-neutral-400">
                  Other validated angles
                </div>

                <div className="divide-y divide-neutral-300/80 border-y border-neutral-300/80">
                  {suggestedAngles.map((item, index) => {
                    const selected = angle === item.text;

                    return (
                      <button
                        key={item.text}
                        type="button"
                        onClick={() => {
                          setAngle(item.text);
                          setPost("");
                          setSaveMessage("");
                          setCopied(false);
                          setLinkedinMessage("");
                          void createPost(item.text);
                        }}
                        className={`group block w-full py-7 text-left transition ${
                          selected
                            ? "bg-white px-5 sm:px-7"
                            : "hover:bg-white/60"
                        }`}
                      >
                        <div className="flex gap-5">
                          <div className="pt-1 font-serif text-sm text-neutral-400">
                            0{index + 1}
                          </div>

                          <div className="max-w-3xl">
                            <div className="font-serif text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">
                              {item.text}
                            </div>

                            {item.why && (
                              <div className="mt-3 text-sm leading-6 text-neutral-600">
                                {item.why}
                              </div>
                            )}

                            {item.evidence && (
                              <div className="mt-3 text-xs leading-5 text-neutral-500">
                                <span className="font-semibold text-neutral-700">
                                  Evidence:
                                </span>{" "}
                                {item.evidence}
                              </div>
                            )}

                            <div
                              className={`mt-4 text-xs font-medium ${
                                selected
                                  ? "text-neutral-900"
                                  : "text-neutral-500 group-hover:text-neutral-900"
                              }`}
                            >
                              {selected
                                ? "Selected angle"
                                : "Choose this angle -"}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {postLoading || post ? (
                <div className="border-b border-neutral-300/80 py-10 text-sm text-neutral-500">
                  {postLoading ? (
                    <>
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-900" />
                      <span className="ml-2">Creating your post...</span>
                    </>
                  ) : (
                    <span>Your post is ready below.</span>
                  )}
                </div>
              ) : angleLoading ? (
                <div className="py-10 text-sm text-neutral-500"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-900" /> <span className="ml-2">Thinking through the story...</span></div>
              ) : null}
            </div>
          </div>
        </section>}

        {post && <section className="border-t border-neutral-900 py-14 sm:py-20">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <button
                type="button"
                onClick={() => {
                  setPost("");
                  setCopied(false);
                  setSaveMessage("");
                  setLinkedinMessage("");
                }}
                className="mb-8 text-sm text-neutral-500 underline underline-offset-4 hover:text-neutral-900"
              >
                --- Back to angles
              </button>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">05 / Write</div>
              <h2 className="mt-2 font-serif text-2xl">Your post.</h2>
              <p className="mt-3 text-xs leading-5 text-neutral-500">One clear idea, in your voice.</p>
            </div>
            <div className="min-w-0">
                <div className="border-y border-neutral-300/80 py-6">
                  <label htmlFor="post-editor" className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                    {editingPostId ? "Edit your saved post" : "Your editable post"}
                  </label>
                  <textarea
                    id="post-editor"
                    value={post}
                    onChange={(event) => setPost(event.target.value)}
                    rows={14}
                    spellCheck
                    className="w-full resize-y bg-transparent px-0 py-2 font-serif text-xl leading-8 tracking-[-0.01em] outline-none placeholder:text-neutral-400 focus:ring-0 sm:text-2xl sm:leading-9"
                    aria-label="Post editor"
                  />
                </div>
                <div className={`mt-5 rounded-lg border px-4 py-3 text-sm ${originalityStatus === "duplicate" ? "border-red-300 bg-red-50 text-red-800" : originalityStatus === "clear" ? "border-green-300 bg-green-50 text-green-800" : "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>
                  <div className="font-medium">Originality check</div>
                  <div className="mt-1">{originalityMessage || "The post will be checked before publishing."}</div>
                </div>
                <div className="mt-6 flex items-center justify-between"><span className="text-xs text-neutral-400">Ready to take with you.</span><div className="flex items-center gap-4">
                  <button
                    onClick={savePost}
                    disabled={saveLoading}
                    className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveLoading ? "Saving..." : editingPostId ? "Update post -" : "Save post -"}
                  </button>

                  <button
                    type="button"
                    onClick={() => void createPost()}
                    disabled={postLoading || !selectedIdea || !angle || !sourceVerified}
                    className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
                  >
                    {postLoading ? "Regenerating..." : "Regenerate -"}
                  </button>
                  <button
                    type="button"
                    onClick={copyPost}
                    disabled={!post.trim()}
                    className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
                  >
                    {copied ? "Copied" : "Copy post -"}
                  </button>
                  {linkedinConnected ? (
                    <button onClick={publishToLinkedIn} disabled={linkedinLoading || originalityStatus !== "clear" || !post.trim()} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:opacity-50">{linkedinLoading ? "Publishing..." : "Publish to LinkedIn -"}</button>
                  ) : (
                    <button onClick={connectLinkedIn} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2">Connect LinkedIn -</button>
                  )}
                </div></div>
              {saveMessage && (
                <div className={`mt-4 text-sm ${saveMessage.toLowerCase().includes("error") || saveMessage.toLowerCase().includes("could") || saveMessage.toLowerCase().includes("please") ? "text-red-700" : "text-neutral-600"}`}>
                  {saveMessage}
                </div>
              )}
                {linkedinMessage && <div className={`mt-3 text-sm ${linkedinMessage.toLowerCase().includes("failed") || linkedinMessage.toLowerCase().includes("could") || linkedinMessage.toLowerCase().includes("connect your") ? "text-red-700" : "text-neutral-600"}`}>{linkedinMessage}</div>}
              </div>
            </div>
        </section>}

        {error && <div className="border-t border-red-300 py-5 text-sm text-red-700">{error}</div>}
        <footer className="flex items-center justify-between border-t border-neutral-300/80 py-8 text-[10px] uppercase tracking-[0.16em] text-neutral-400"><span>PostCraft AI</span></footer>
      </div>
    </main>
  );
}

