import type { Comment, Depth, Platform, Position, Style } from "./types";

export type GenerateInput = {
  post: string;
  url: string;
  attachment?: { type: string; data: string; name: string } | null;
  platform: Platform;
  position: Position;
  styles: Style[];
  depth: Depth;
};

async function request(body: Record<string, unknown>) {
  const response = await fetch("/api/commentcraft-ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 429) throw new Error("AI usage limit reached. Please try again later.");
    if (response.status === 503) throw new Error("The AI service is temporarily busy. Please try again.");
    throw new Error(data?.error || "Unable to complete the Comment AI request.");
  }
  return data;
}

export async function generateComments(input: GenerateInput): Promise<Comment[]> {
  const attachment = input.attachment;
  const data = await request({
    action: "generate",
    post: input.post.trim(),
    content_url: input.url.trim(),
    image_base64: attachment?.type.startsWith("image/") ? attachment.data.replace(/^data:[^;]+;base64,/, "") : undefined,
    image_mime_type: attachment?.type.startsWith("image/") ? attachment.type : undefined,
    file_base64: attachment && !attachment.type.startsWith("image/") ? attachment.data.replace(/^data:[^;]+;base64,/, "") : undefined,
    file_mime_type: attachment && !attachment.type.startsWith("image/") ? attachment.type : undefined,
    file_name: attachment && !attachment.type.startsWith("image/") ? attachment.name : undefined,
    platform: input.platform.toLowerCase(),
    position: input.position,
    styles: input.styles,
    depth: input.depth,
    keywords: [],
    count: 5,
  });

  return (data.comments ?? [])
    .map((item: Partial<Comment>) => ({
      id: item.id || crypto.randomUUID(),
      comment_text: item.comment_text || "",
      quality_score: item.quality_score ?? 0,
      why_it_works: item.why_it_works ?? null,
      is_favorite: Boolean(item.is_favorite),
    }))
    .filter((item: Comment) => item.comment_text);
}

export async function summarizeSource(input: GenerateInput): Promise<string> {
  const attachment = input.attachment;
  const data = await request({
    action: "summarize",
    post: input.post.trim(),
    content_url: input.url.trim(),
    image_base64: attachment?.type.startsWith("image/") ? attachment.data.replace(/^data:[^;]+;base64,/, "") : undefined,
    image_mime_type: attachment?.type.startsWith("image/") ? attachment.type : undefined,
    file_base64: attachment && !attachment.type.startsWith("image/") ? attachment.data.replace(/^data:[^;]+;base64,/, "") : undefined,
    file_mime_type: attachment && !attachment.type.startsWith("image/") ? attachment.type : undefined,
    file_name: attachment && !attachment.type.startsWith("image/") ? attachment.name : undefined,
    platform: input.platform.toLowerCase(),
  });
  return typeof data.summary === "string" ? data.summary : "";
}

export async function refineComment(comment: Comment, instruction: string, platform: Platform): Promise<Partial<Comment>> {
  const data = await request({
    action: "refine",
    comment: comment.comment_text,
    instruction: instruction.trim() || "Make this more natural",
    platform: platform.toLowerCase(),
  });
  return {
    comment_text: data.comment_text || data.comments?.[0]?.comment_text,
    quality_score: data.quality_score ?? data.comments?.[0]?.quality_score,
    why_it_works: data.why_it_works ?? data.comments?.[0]?.why_it_works,
  };
}
