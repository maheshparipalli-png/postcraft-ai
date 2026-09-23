import { NextRequest, NextResponse } from "next/server";
import { decryptLinkedInSession, linkedinCookieName } from "@/lib/linkedin";
import { getBillingAccess } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";
import { createHash } from "node:crypto";
import { assertPublicUrl } from "@/lib/research/verify-source";

const linkedinHeaders = (accessToken: string) => ({
  Authorization: `Bearer ${accessToken}`,
  "Content-Type": "application/json",
  "Linkedin-Version": process.env.LINKEDIN_VERSION || "202601",
  "X-Restli-Protocol-Version": "2.0.0",
});

async function fetchImageDataUrl(imageUrl: string | null, sourceUrl: string | null) {
  const candidates = [imageUrl, sourceUrl].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      let resolvedImageUrl = candidate;

      await assertPublicUrl(resolvedImageUrl);

      if (!/^https?:\/\//i.test(candidate) || /\.(html?|php)(?:[?#].*)?$/i.test(candidate)) {
        const pageResponse = await fetchPublicUrl(candidate, {
          headers: { "User-Agent": "PostCraft AI/1.0", Accept: "text/html,application/xhtml+xml" },
          signal: AbortSignal.timeout(8000),
        });
        if (!pageResponse.ok) continue;

        const contentLength = Number(pageResponse.headers.get("content-length") ?? "0");
        if (contentLength > 2 * 1024 * 1024) continue;

        const html = await pageResponse.text();
        if (html.length > 2 * 1024 * 1024) continue;

        const match =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/i) ||
          html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["'][^>]*>/i);

        if (!match?.[1]) continue;
        resolvedImageUrl = new URL(match[1], pageResponse.url || candidate).toString();
      }

      const imageResponse = await fetchPublicUrl(resolvedImageUrl, {
        headers: { "User-Agent": "PostCraft AI/1.0", Accept: "image/png,image/jpeg,image/jpg" },
        signal: AbortSignal.timeout(10000),
      });
      if (!imageResponse.ok) continue;

      const contentLength = Number(imageResponse.headers.get("content-length") ?? "0");
      if (contentLength > 10 * 1024 * 1024) continue;

      const contentType = (imageResponse.headers.get("content-type") || "").split(";")[0].toLowerCase();
      if (contentType !== "image/png" && contentType !== "image/jpeg" && contentType !== "image/jpg") continue;

      const bytes = Buffer.from(await imageResponse.arrayBuffer());
      if (!bytes.length || bytes.length > 10 * 1024 * 1024) continue;

      const mimeType = contentType === "image/jpg" ? "image/jpeg" : contentType;
      return `data:${mimeType};base64,${bytes.toString("base64")}`;
    } catch {
      // Try the next candidate; publishing should still work as text if no image is accessible.
    }
  }

  return null;
}

async function fetchPublicUrl(
  initialUrl: string,
  init: RequestInit = {},
  maxRedirects = 5,
) {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    await assertPublicUrl(currentUrl);

    const response = await fetch(currentUrl, {
      ...init,
      redirect: "manual",
      cache: "no-store",
    });

    if (response.status < 300 || response.status >= 400) {
      return response;
    }

    const location = response.headers.get("location");
    if (!location) throw new Error("The remote image returned an invalid redirect.");

    currentUrl = new URL(location, currentUrl).toString();

    if (redirectCount === maxRedirects) {
      throw new Error("The remote image redirected too many times.");
    }
  }

  throw new Error("The remote image could not be fetched.");
}
async function publishImage(accessToken: string, owner: string, imageDataUrl: string, _altText: string) {
  const match = imageDataUrl.match(/^data:(image\/(?:png|jpeg|jpg));base64,(.+)$/);
  if (!match) throw new Error("The visual post image is invalid. Please generate it again.");
  const mimeType = match[1] === "image/jpg" ? "image/jpeg" : match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length > 10 * 1024 * 1024) throw new Error("The visual post image is too large.");

  const initializeResponse = await fetch("https://api.linkedin.com/rest/images?action=initializeUpload", {
    method: "POST",
    headers: linkedinHeaders(accessToken),
    body: JSON.stringify({ initializeUploadRequest: { owner } }),
  });
  const initializeText = await initializeResponse.text();
  if (!initializeResponse.ok) throw new Error(`LinkedIn image registration failed: ${initializeText}`);
  type LinkedInImageUploadResponse = { value?: { uploadUrl?: string; image?: string } };
  let initializeData: LinkedInImageUploadResponse;
  try { initializeData = JSON.parse(initializeText); } catch { throw new Error("LinkedIn returned an invalid image registration response."); }
  const uploadUrl = initializeData?.value?.uploadUrl;
  const imageUrn = initializeData?.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error("LinkedIn did not return an image upload URL.");

  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: bytes,
  });
  if (!uploadResponse.ok) throw new Error(`LinkedIn image upload failed: ${await uploadResponse.text()}`);

  return imageUrn;
}

export async function POST(request: NextRequest) {
  try {
    const cookie = request.cookies.get(linkedinCookieName())?.value;
    const session = cookie ? decryptLinkedInSession(cookie) : null;
    if (!session) return NextResponse.json({ error: "Connect your LinkedIn account first." }, { status: 401 });

    const body = await request.json();
    const postId = typeof body?.postId === "string" ? body.postId.trim() : null;
    const sourceUrl = typeof body?.sourceUrl === "string" ? body.sourceUrl.trim() : null;
    const sourceTitle = typeof body?.sourceTitle === "string" ? body.sourceTitle.trim() : null;
    const commentary = typeof body?.commentary === "string" ? body.commentary.trim() : "";
    const imageUrl = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : null;
    const includeSourceImage = body?.includeSourceImage === true;
    const imageDataUrl = typeof body?.imageDataUrl === "string" ? body.imageDataUrl : (includeSourceImage ? await fetchImageDataUrl(imageUrl, sourceUrl) : null);
    if (!commentary) return NextResponse.json({ error: "There is no post to publish." }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in first." }, { status: 401 });
    if (session.userId !== user.id) return NextResponse.json({ error: "LinkedIn connection does not belong to this account. Please reconnect LinkedIn." }, { status: 403 });

    if (postId) {
      const { data: savedPost, error: savedPostError } = await supabase
        .from("posts")
        .select("id,status")
        .eq("id", postId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (savedPostError) throw savedPostError;
      if (!savedPost) return NextResponse.json({ error: "The saved post could not be found." }, { status: 404 });
      if (savedPost.status === "published") return NextResponse.json({ error: "This post has already been published." }, { status: 409 });
    }

    const billing = await getBillingAccess();
    if (!billing.allowed) {
      return NextResponse.json({
        error: billing.status === "expired" ? "Your free trial has expired. Subscribe to continue publishing." : "Start your free trial or subscribe to continue publishing.",
        status: billing.status,
      }, { status: 402 });
    }

    const normalizeUrl = (value: string | null) => {
      if (!value) return null;
      try {
        const url = new URL(value);
        url.hash = "";
        ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "gclid", "fbclid"].forEach((key) => url.searchParams.delete(key));
        url.search = url.searchParams.toString();
        return url.toString().replace(/\/$/, "");
      } catch { return value.trim().replace(/\/$/, ""); }
    };
    const normalizedSourceUrl = normalizeUrl(sourceUrl);
    const contentHash = createHash("sha256").update(commentary.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");

    const { data: existing } = await supabase
      .from("postcraft_publications")
      .select("id, linkedin_post_id")
      .eq("user_id", user.id)
      .or(`content_hash.eq.${contentHash}${normalizedSourceUrl ? `,source_url.eq.${normalizedSourceUrl}` : ""}`)
      .limit(1);
    if (existing?.length) return NextResponse.json({ error: "Duplicate content detected. This article or a substantially identical post has already been published." }, { status: 409 });

    const content: Record<string, unknown> = {};
    if (imageDataUrl) {
      const imageUrn = await publishImage(session.accessToken, session.personUrn, imageDataUrl, sourceTitle || "PostCraft visual post");
      content.media = { altText: sourceTitle || "PostCraft visual LinkedIn post", id: imageUrn };
    }

    const postBody: Record<string, unknown> = {
      author: session.personUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    };
    if (imageDataUrl) postBody.content = content;

    const response = await fetch("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: linkedinHeaders(session.accessToken),
      body: JSON.stringify(postBody),
    });
    const responseText = await response.text();
    if (!response.ok) {
      let detail = responseText;
      try { detail = JSON.parse(responseText)?.message || detail; } catch { /* plain text */ }
      return NextResponse.json({ error: `LinkedIn publishing failed: ${detail}` }, { status: response.status });
    }
    const linkedinPostId = response.headers.get("x-restli-id") || null;
    const { error: historyError } = await supabase.from("postcraft_publications").insert({
      user_id: user.id,
      linkedin_post_id: linkedinPostId,
      source_url: normalizedSourceUrl,
      source_title: sourceTitle,
      post_text: commentary,
      content_hash: contentHash,
      published_at: new Date().toISOString(),
    });
    if (historyError) console.error("Could not save publication history:", historyError);

    let warning: string | null = null;
    if (postId) {
      const { error: postUpdateError } = await supabase
        .from("posts")
        .update({ status: "published", updated_at: new Date().toISOString() })
        .eq("id", postId)
        .eq("user_id", user.id);
      if (postUpdateError) {
        console.error("Could not mark post as published:", postUpdateError);
        warning = "The post was published, but its workspace status could not be updated.";
      }
    }

    return NextResponse.json({ ok: true, id: linkedinPostId, format: imageDataUrl ? "image" : "text", warning });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not publish to LinkedIn." }, { status: 500 });
  }
}
