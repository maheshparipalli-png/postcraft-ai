import crypto from "node:crypto";

const COOKIE_NAME = "postcraft_linkedin";

function getKey() {
  const secret = process.env.LINKEDIN_COOKIE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.LINKEDIN_CLIENT_SECRET;
  if (!secret) throw new Error("Missing LINKEDIN_COOKIE_SECRET.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function linkedinCookieName() {
  return COOKIE_NAME;
}

export function encryptLinkedInSession(value: { accessToken: string; expiresAt: number; personUrn: string }) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptLinkedInSession(value: string) {
  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) return null;
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const session = JSON.parse(decrypted) as { accessToken: string; expiresAt: number; personUrn: string };
    if (!session.accessToken || !session.personUrn || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function getLinkedInConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  const redirectUri = process.env.LINKEDIN_REDIRECT_URI || "http://localhost:3000/api/linkedin/callback";
  if (!clientId || !clientSecret) throw new Error("LinkedIn credentials are not configured.");
  return { clientId, clientSecret, redirectUri };
}
