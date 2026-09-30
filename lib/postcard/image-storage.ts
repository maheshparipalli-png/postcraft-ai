import crypto from "node:crypto";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "postcraft-images";

export async function persistGeneratedImage(input: {
  userId: string;
  image: { url?: string; b64Json?: string; mimeType: string };
}) {
  let bytes: Buffer;
  let mimeType = input.image.mimeType || "image/png";

  if (input.image.b64Json) {
    bytes = Buffer.from(input.image.b64Json, "base64");
  } else if (input.image.url) {
    const response = await fetch(input.image.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Generated image download failed (${response.status}).`);
    }
    const contentType = response.headers.get("content-type");
    if (contentType?.startsWith("image/")) mimeType = contentType;
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("Generated image contains neither image data nor a URL.");
  }

  if (!bytes.length) throw new Error("Generated image is empty.");

  // Providers may return a different canvas size than requested. Normalize the
  // persisted PostCard asset so downloads and LinkedIn publishing are consistent.
  bytes = await sharp(bytes)
    .resize(1200, 1500, { fit: "cover", position: "center" })
    .png()
    .toBuffer();
  mimeType = "image/png";

  const path = `${input.userId}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.png`;
  const admin = createAdminClient();

  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType: mimeType,
      cacheControl: "31536000",
      upsert: false,
    });

  if (error) throw new Error(`Could not store generated image: ${error.message}`);

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);

  return {
    url: data.publicUrl,
    storagePath: path,
    mimeType,
    size: bytes.length,
  };
}
