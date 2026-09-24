import { decodeHtmlEntities } from "@/lib/text/decode-html";
﻿"use client";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import SignOutButton from "./SignOutButton";
import MarketingHome from "./ui/marketing-home";

type Idea = { title: string; description: string; whyItMatters: string; sourceIndexes: number[]; source: string; url: string; imageUrl?: string | null; publishedAt: string; interest?: string };
type Evidence = { claim: string; support: string; type: "fact" | "interpretation" | "uncertainty" };
type AngleSuggestion = { text: string; why: string; evidence: string };
type Perspective = "agree" | "disagree" | "mixed" | "curious";
type PublishFormat = "combined" | "text" | "image";
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


function cleanGeneratedPost(value: string) {
  return value
    .replace(/^\`\`\`(?:text|markdown|json)?\s*/i, "")
    .replace(/\s*\`\`\`$/i, "")
    .replace(/^\s*(LinkedIn post|Post):\s*/i, "")
    .replace(/\n+\s*Source\s*:\s*[^\n]*$/i, "")
    .replace(/\n+\s*(?:Read the original article|Original article)\s*:?\s*https?:\/\/\S+\s*$/i, "")
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .trim();
}

function renderPostCardImage(title: string, post: string, angle: string, source: string) {
  const width = 1080;
  const height = 1350;
  const margin = 78;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create the PostCard infographic.");

  ctx.fillStyle = "#171717";
  ctx.fillRect(0, 0, width, height);

  const wrap = (text: string, maxWidth: number, font: string) => {
    ctx.font = font;
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const next = line ? line + " " + word : word;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  };

  const fit = (text: string, maxWidth: number, start: number, min: number, maxLines: number, family = "Arial", weight = "700") => {
    for (let size = start; size >= min; size -= 1) {
      const font = `${weight} ${size}px ${family}`;
      const lines = wrap(text, maxWidth, font);
      if (lines.length <= maxLines) return { size, lines };
    }
    return { size: min, lines: wrap(text, maxWidth, `${weight} ${min}px ${family}`).slice(0, maxLines) };
  };

  ctx.fillStyle = "#a3a3a3";
  ctx.font = "700 16px Arial";
  ctx.fillText("POSTCRAFT · LINKEDIN INFOCARD", margin, 72);

  const titleFit = fit(title, width - margin * 2, 52, 30, 4, "Georgia", "700");
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${titleFit.size}px Georgia`;
  let y = 155;
  titleFit.lines.forEach((line) => { ctx.fillText(line, margin, y); y += titleFit.size * 1.2; });

  y += 25;
  ctx.fillStyle = "#d6d3d1";
  const angleFit = fit(angle || "The key tension behind this story.", width - margin * 2, 27, 20, 4, "Arial", "400");
  ctx.font = `400 ${angleFit.size}px Arial`;
  angleFit.lines.forEach((line) => { ctx.fillText(line, margin, y); y += angleFit.size * 1.35; });

  y += 38;
  ctx.strokeStyle = "#3f3f46";
  ctx.beginPath(); ctx.moveTo(margin, y); ctx.lineTo(width - margin, y); ctx.stroke();

  const cleaned = decodeHtmlEntities(
    post
      .replace(/^.*?\n\s*\n/, "")
      .replace(/\bhttps?:\/\/\S+/gi, "")
      .trim(),
  );
  const sentences = cleaned.match(/[^.!?]+[.!?]+/g)?.map((s) => s.trim()).filter(Boolean) || [];
  const points = sentences.slice(0, 3);
  points.forEach((point, index) => {
    y += 55;
    ctx.fillStyle = "#a3a3a3";
    ctx.font = "700 18px Arial";
    ctx.fillText(String(index + 1).padStart(2, "0"), margin, y);
    const p = fit(point.replace(/[.!?]+$/, ""), width - margin * 2 - 65, 25, 18, 4, "Arial", "400");
    ctx.fillStyle = "#f5f5f5";
    ctx.font = `400 ${p.size}px Arial`;
    let py = y;
    p.lines.forEach((line) => { ctx.fillText(line, margin + 58, py); py += p.size * 1.3; });
    y = py;
  });

  const takeaway = sentences.length > 3 ? sentences[sentences.length - 1].replace(/[.!?]+$/, "") : angle;
  if (takeaway.trim()) {
    y += 32;
    ctx.fillStyle = "#737373";
    ctx.font = "700 15px Arial";
    ctx.fillText("THE TAKEAWAY", margin, y);
    y += 30;
    const t = fit(takeaway, width - margin * 2, 28, 19, 4, "Georgia", "700");
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${t.size}px Georgia`;
    t.lines.forEach((line) => { ctx.fillText(line, margin, y); y += t.size * 1.3; });
  }

  const footerY = height - 72;
  ctx.strokeStyle = "#3f3f46";
  ctx.beginPath(); ctx.moveTo(margin, footerY - 22); ctx.lineTo(width - margin, footerY - 22); ctx.stroke();
  ctx.fillStyle = "#a3a3a3";
  ctx.font = "14px Arial";
  ctx.fillText(source ? `Source: ${source}` : "PostCraft AI", margin, footerY);
  return canvas.toDataURL("image/png");
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
  const [verifiedSummary, setVerifiedSummary] = useState("");
  const [suggestedAngles, setSuggestedAngles] = useState<AngleSuggestion[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [perspective, setPerspective] = useState<Perspective>("mixed");
  const [perspectiveNote, setPerspectiveNote] = useState("");
  const [post, setPost] = useState("");
  const [postCardImage, setPostCardImage] = useState("");
  const [postCardRendering, setPostCardRendering] = useState(false);
  const [publishFormat, setPublishFormat] = useState<PublishFormat>("combined");
  const [copied, setCopied] = useState(false);
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [linkedinLoading, setLinkedinLoading] = useState(false);
  const [linkedinMessage, setLinkedinMessage] = useState("");
  const [linkedinDisconnecting, setLinkedinDisconnecting] = useState(false);
  const [originalityStatus, setOriginalityStatus] = useState<"idle" | "checking" | "clear" | "duplicate">("idle");
  const [originalityMessage, setOriginalityMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [angleLoading, setAngleLoading] = useState(false);
  const [generationStatus, setGenerationStatus] = useState("");
  const [error, setError] = useState("");
  const angleRequestRef = useRef(0);
  const angleAbortRef = useRef<AbortController | null>(null);

  const [authUser, setAuthUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [appAccessAllowed, setAppAccessAllowed] = useState(false);
  const [accessNotice, setAccessNotice] = useState("");

  useEffect(() => {
    let active = true;

    async function loadAccess() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;

        if (!user) {
          setAuthUser(null);
          setAppAccessAllowed(false);
          setAuthReady(true);
          return;
        }

        setAuthUser({ id: user.id, email: user.email });

        const preferencesResponse = await fetch("/api/preferences/interests", { cache: "no-store" });
        const preferences = await preferencesResponse.json().catch(() => null);
        if (preferencesResponse.ok && !preferences?.completed) {
          router.replace("/interests?next=/");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.role === "admin" || profile?.role === "super_admin") {
          setAppAccessAllowed(true);
          setAuthReady(true);
          return;
        }

        const response = await fetch("/api/billing/status", { cache: "no-store" });
        const billing = await response.json();
        if (!active) return;

        const status = typeof billing?.status === "string" ? billing.status : "not_started";
        setAppAccessAllowed(Boolean(billing?.allowed));
        if (status === "expired") {
          setAccessNotice("Your free trial has ended. Start a subscription to continue using PostCraft.");
        } else if (status === "not_started") {
          setAccessNotice("Your 15-day free trial is ready to start.");
        }
        setAuthReady(true);
      } catch {
        if (!active) return;
        setAppAccessAllowed(false);
        setAuthReady(true);
      }
    }

    void loadAccess();
    return () => { active = false; };
  }, []);


  // URL callback parameters and saved-post hydration are intentionally handled after mount.
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
      const raw = await response.text();
      let data: { error?: string; code?: string; count?: number; ideas?: Idea[] } | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }
      if (!response.ok) {
        const detail = data?.error || (raw && raw.trim() ? raw.slice(0, 220) : "");
        throw new Error(detail || `Discovery could not be completed (HTTP ${response.status}).`);
      }
      const discoveredIdeas = Array.isArray(data?.ideas) ? data.ideas : [];
      if (!discoveredIdeas.length) {
        throw new Error("No high-value stories met your interest and quality filters today. PostCraft will not add filler.");
      }
      setIdeas(discoveredIdeas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authReady || !authUser || !appAccessAllowed) return;
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
  }, [authReady, authUser?.id, appAccessAllowed]);

  useEffect(() => {
    if (angleLoading || !post.trim() || !selectedIdea) {
      setPostCardImage("");
      return;
    }
    let cancelled = false;
    setPostCardRendering(true);
    try {
      const image = renderPostCardImage(
        decodeHtmlEntities(selectedIdea.title),
        post,
        angle,
        decodeHtmlEntities(selectedIdea.source),
      );
      if (!cancelled) setPostCardImage(image);
    } catch (err) {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not create the PostCard infographic.");
    } finally {
      if (!cancelled) setPostCardRendering(false);
    }
    return () => { cancelled = true; };
  }, [post, selectedIdea, angle]);

  if (!authReady) {
    return <MarketingHome />;
  }

  if (!authUser || !appAccessAllowed) {
    return <MarketingHome authenticated={Boolean(authUser)} notice={accessNotice} />;
  }

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
    setVerifiedSummary("");
    setPublishFormat("combined");
    setPostCardImage("");
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
    setSourceUrl(idea.url);
    setError("");
    setGenerationStatus("Checking the source and building the editorial angle…");
    setAngleLoading(true);

    try {
      const response = await fetch("/api/discover/editorial/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: idea.url,
          title: idea.title,
          source: idea.source,
          summary: idea.description,
          interest: idea.interest || topic,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const raw = await response.text();
        let data: { error?: string } | null = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }
        throw new Error(
          data?.error ||
          (raw && raw.trim() ? raw.trim().slice(0, 300) : "") ||
          `PostCraft could not create the post (HTTP ${response.status}).`,
        );
      }

      if (!response.body) {
        throw new Error("PostCraft did not return a streaming response. Please try again.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamedPost = "";
      let completed = false;

      const applyDone = (data: {
        article?: {
          title?: string;
          source?: string;
          url?: string;
          publishedAt?: string;
          content?: string;
        };
        post?: string;
        selectedAngle?: { angle?: string; why?: string; evidence?: string };
        angle?: { angle?: string; why?: string; evidence?: string };
        angles?: unknown[];
        evidence?: unknown[];
      }) => {
        if (!data.post || !(data.selectedAngle?.angle || data.angle?.angle)) {
          throw new Error("PostCraft returned an incomplete editorial draft. No validated post and angle were received.");
        }

        const selected = data.selectedAngle || data.angle;
        if (!selected?.angle) {
          throw new Error("PostCraft did not return a usable editorial angle.");
        }

        const selectedText = selected.angle.trim();
        const generatedPost = cleanGeneratedPost(data.post);

        const generatedAngles: AngleSuggestion[] = Array.isArray(data.angles)
          ? data.angles
              .map((item: unknown): AngleSuggestion | null => {
                if (!item || typeof item !== "object") return null;
                const value = item as { angle?: unknown; why?: unknown; evidence?: unknown };
                const text = typeof value.angle === "string" ? value.angle.trim() : "";
                if (!text) return null;
                return {
                  text,
                  why: typeof value.why === "string" ? value.why.trim() : "",
                  evidence: typeof value.evidence === "string" ? value.evidence.trim() : "",
                };
              })
              .filter((item: AngleSuggestion | null): item is AngleSuggestion => Boolean(item))
            : [];

        const verifiedArticle = data.article;
        const verifiedTitle = decodeHtmlEntities(
          verifiedArticle?.title?.trim() || idea.title,
        );
        const verifiedSource = decodeHtmlEntities(
          verifiedArticle?.source?.trim() || idea.source,
        );
        const verifiedUrl = verifiedArticle?.url?.trim() || idea.url;
        const verifiedDate = formatDateInput(verifiedArticle?.publishedAt || idea.publishedAt);
        const verifiedContent = verifiedArticle?.content?.trim() || idea.description || "";

        setNewsTitle(verifiedTitle);
        setNewsSource(verifiedSource);
        setNewsDate(verifiedDate);
        setSourceUrl(verifiedUrl);
        setVerifiedSummary(verifiedContent);

        const generatedEvidence: Evidence[] = Array.isArray(data.evidence)
          ? data.evidence
              .map((item: unknown): Evidence | null => {
                if (!item || typeof item !== "object") return null;
                const value = item as { claim?: unknown; support?: unknown; type?: unknown };
                const claim = typeof value.claim === "string" ? value.claim.trim() : "";
                const support = typeof value.support === "string" ? value.support.trim() : "";
                const type =
                  value.type === "fact" || value.type === "interpretation" || value.type === "uncertainty"
                    ? value.type
                    : "fact";
                return claim && support ? { claim, support, type } : null;
              })
              .filter((item: Evidence | null): item is Evidence => Boolean(item))
            : [];

        setEvidence(generatedEvidence);
        setSuggestedAngles(generatedAngles);
        setAngle(selectedText);

        const storyTitle = verifiedTitle;
        const titleNormalized = storyTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const postNormalized = generatedPost.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        const postWithTitle = postNormalized.startsWith(titleNormalized)
          ? generatedPost
          : `${storyTitle}\n\n${generatedPost}`;

        setPost(postWithTitle);
        setOriginalityStatus("idle");
        setOriginalityMessage("");
        setGenerationStatus("");
        completed = true;
      };

      const consumeLine = (line: string) => {
        if (!line.trim()) return;

        let event: {
          type?: string;
          message?: string;
          token?: string;
          error?: string;
          article?: {
            title?: string;
            source?: string;
            url?: string;
            publishedAt?: string;
            content?: string;
          };
          post?: string;
          selectedAngle?: { angle?: string; why?: string; evidence?: string };
          angle?: { angle?: string; why?: string; evidence?: string };
          angles?: unknown[];
          evidence?: unknown[];
        };

        try {
          event = JSON.parse(line);
        } catch {
          return;
        }

        if (event.type === "status") {
          setGenerationStatus(event.message || "PostCraft is working on the story…");
          return;
        }

        if (event.type === "token") {
          const token = typeof event.token === "string" ? event.token : "";
          if (!token) return;
          streamedPost += token;
          setGenerationStatus("Writing the LinkedIn post…");
          setPost(streamedPost);
          return;
        }

        if (event.type === "error") {
          throw new Error(event.error || "PostCraft could not complete the editorial draft.");
        }

        if (event.type === "done") {
          applyDone(event);
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          consumeLine(line);
        }
      }

      buffer += decoder.decode();
      if (buffer.trim()) consumeLine(buffer);

      if (!completed) {
        throw new Error("PostCraft ended the editorial stream before returning a validated draft.");
      }

      if (requestId !== angleRequestRef.current) return;
    } catch (err) {
      if (controller.signal.aborted) return;
      if (requestId === angleRequestRef.current) {
        setPost("");
        setPostCardImage("");
        setError(err instanceof Error ? err.message : "PostCraft could not create the post.");
      }
    } finally {
      if (requestId === angleRequestRef.current) {
        setGenerationStatus("");
        setAngleLoading(false);
      }
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
    if (!post.trim()) return;
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
          imageUrl: publishFormat === "text" ? null : (selectedIdea?.imageUrl || null),
          imageDataUrl: publishFormat === "text" ? undefined : (postCardImage || undefined),
          includeSourceImage: false,
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
              <Link href="/postcard" className="text-neutral-500 transition hover:text-neutral-900">PostCard</Link>
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
                className="w-full resize-y border-y border-neutral-300/80 bg-transparent px-0 py-7 font-serif text-base leading-7 tracking-[-0.005em] outline-none focus:border-neutral-900 sm:text-lg sm:leading-8"
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
                <Link href="/postcard" className="text-xs text-neutral-500 transition hover:text-neutral-900">PostCard</Link>
                <Link href="/commentcraft" className="text-xs text-neutral-500 transition hover:text-neutral-900">CommentCraft</Link>
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
            <p className="mt-7 max-w-xl text-base leading-7 text-neutral-600">Start with a story. PostCraft thinks through the story and writes the post automatically.</p>
          </div>
        </section>

        {ideas.length > 0 && <section className="border-t border-neutral-300/80 py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[190px_1fr]">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">02 / Choose</div>
              <h2 className="mt-2 font-serif text-2xl">The strongest stories across your interests.</h2>
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.12em] text-neutral-500"><span>{idea.interest || "Selected interest"}</span><span className="text-neutral-300">·</span><span>{idea.source}{idea.publishedAt ? ` - Published ${formatPublishedAtIST(idea.publishedAt)}` : ""}</span></div>
                      <h3 className="mt-2 max-w-3xl font-serif text-2xl leading-tight tracking-[-0.02em] sm:text-3xl">{idea.title}</h3>
                      {idea.description && <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{idea.description}</p>}
                      {idea.whyItMatters && <div className="mt-5 max-w-2xl border-l border-neutral-400 pl-4"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-500">Why this is interesting</div><p className="mt-1.5 text-sm leading-6 text-neutral-800">{idea.whyItMatters}</p></div>}
                      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs">
                        <a href={idea.url} target="_blank" rel="noreferrer" className="cursor-pointer text-neutral-500 underline underline-offset-4 hover:text-neutral-900">Read source</a>
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
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">03 / Write</div>
              <h2 className="mt-2 font-serif text-2xl">PostCraft is writing your post.</h2>
            </div>
            <div>
              <div className="max-w-2xl border-b border-neutral-300/80 pb-7">
                <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Selected story</div>
                <div className="mt-2 font-serif text-xl leading-7">{selectedIdea.title}</div>
                <p className="mt-3 max-w-xl text-xs leading-5 text-neutral-500">
                  {generationStatus || "PostCraft is generating your LinkedIn post automatically."}
                </p>
              </div>
            {angleLoading ? (
                <div className="py-10 text-sm text-neutral-500"><span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-neutral-900" /> <span className="ml-2">Creating your post...</span></div>
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
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-500">04 / Write</div>
              <h2 className="mt-2 font-serif text-2xl">Your post.</h2>
              <p className="mt-3 text-xs leading-5 text-neutral-500">One clear idea, in your voice.</p>
            </div>
            <div className="min-w-0">
                <div className="grid gap-6 border-b border-neutral-300/80 py-6 md:grid-cols-[1fr_auto]">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Selected source</div>
                    <h3 className="mt-2 font-serif text-2xl leading-tight">{newsTitle || selectedIdea?.title}</h3>
                    <p className="mt-2 text-sm text-neutral-500">{newsSource || selectedIdea?.source}</p>
                    {verifiedSummary && <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">{verifiedSummary}</p>}
                    {sourceUrl && (
                      <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-sm font-medium underline underline-offset-4">
                        Read source article ↗
                      </a>
                    )}
                  </div>
                  <div className="self-start border-l border-neutral-300 pl-5">
                    <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Recommended angle</div>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-neutral-800">{angle || "Editorial angle"}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-300/80 py-5">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.15em] text-neutral-400">Publishing format</div>
                    <p className="mt-1 text-xs text-neutral-500">Choose what will be sent to LinkedIn.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {([["combined", "Text + visual"], ["text", "Text only"], ["image", "Visual only"]] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setPublishFormat(value)}
                        className={`rounded-full border px-3 py-2 text-xs font-medium ${publishFormat === value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-300 text-neutral-600 hover:border-neutral-600"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

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
                    className="w-full resize-y bg-transparent px-0 py-2 font-serif text-base leading-7 tracking-[-0.005em] outline-none placeholder:text-neutral-400 focus:ring-0 sm:text-lg sm:leading-8"
                    aria-label="Post editor"
                  />
                </div>
                {publishFormat !== "image" && <div className="mt-8">
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Draft commentary</div>
                </div>}
                <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <div className="rounded-2xl border border-neutral-300/80 bg-[#171717] p-4">
                    <div className="mb-3 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">
                      <span>PostCard · Infographic</span>
                      <span>{postCardRendering ? "Creating…" : "Ready"}</span>
                    </div>
                    {postCardImage ? (
                      <img src={postCardImage} alt="PostCraft LinkedIn infographic PostCard" className="w-full rounded-lg" />
                    ) : (
                      <div className="flex aspect-[4/5] items-center justify-center rounded-lg bg-neutral-900 text-sm text-neutral-500">
                        Creating your infographic…
                      </div>
                    )}
                  </div>
                  <div className="self-start rounded-2xl border border-neutral-300/80 bg-[#f1efe9] p-6">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">PostCard content</div>
                    <h3 className="mt-3 font-serif text-2xl leading-tight">{selectedIdea?.title || newsTitle}</h3>
                    <p className="mt-4 text-sm leading-6 text-neutral-600">{angle || "Editorial angle"}</p>
                    <p className="mt-5 text-xs leading-5 text-neutral-500">The infographic uses the same title, editorial angle, key points and takeaway as the LinkedIn post.</p>
                  </div>
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
                    onClick={copyPost}
                    disabled={!post.trim()}
                    className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:border-neutral-300 disabled:text-neutral-400"
                  >
                    {copied ? "Copied" : "Copy post -"}
                  </button>
                  {linkedinConnected ? (
                    <button onClick={publishToLinkedIn} disabled={linkedinLoading || !post.trim()} className="border-b border-neutral-900 pb-1 text-sm font-medium hover:pr-2 disabled:cursor-not-allowed disabled:opacity-50">{linkedinLoading ? "Publishing..." : "Publish to LinkedIn -"}</button>
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



