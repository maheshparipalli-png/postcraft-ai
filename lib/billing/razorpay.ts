import crypto from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function getConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const planId = process.env.RAZORPAY_PLAN_ID;

  if (!keyId || !keySecret || !planId) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_PLAN_ID.");
  }

  return { keyId, keySecret, planId };
}

export function getRazorpayPublicKey() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) throw new Error("RAZORPAY_KEY_ID is not configured.");
  return keyId;
}

async function razorpayRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { keyId, keySecret } = getConfig();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
  const response = await fetch(`${RAZORPAY_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { error: text }; }

  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data
        ? JSON.stringify((data as { error: unknown }).error)
        : `Razorpay request failed with HTTP ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export type RazorpaySubscription = {
  id: string;
  plan_id: string;
  customer_id?: string | null;
  status: string;
  current_start?: number | null;
  current_end?: number | null;
  start_at?: number | null;
  charge_at?: number | null;
  short_url?: string | null;
};

export async function createRazorpaySubscription(input: {
  userId: string;
  email?: string | null;
  name?: string | null;
}) {
  const { planId } = getConfig();
  const totalCount = Number.parseInt(process.env.RAZORPAY_TOTAL_COUNT ?? "1200", 10);

  if (!Number.isInteger(totalCount) || totalCount < 1) {
    throw new Error("RAZORPAY_TOTAL_COUNT must be a positive integer.");
  }

  return razorpayRequest<RazorpaySubscription>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      total_count: totalCount,
      quantity: 1,
      customer_notify: true,
      notes: {
        postcraft_user_id: input.userId,
        email: input.email ?? "",
        name: input.name ?? "",
      },
    }),
  });
}


export async function getRazorpaySubscription(subscriptionId: string) {
  if (!subscriptionId.trim()) throw new Error("Razorpay subscription ID is required.");
  return razorpayRequest<RazorpaySubscription>(`/subscriptions/${encodeURIComponent(subscriptionId)}`);
}

export function verifySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
) {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("RAZORPAY_KEY_SECRET is not configured.");

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function verifyWebhookSignature(body: string, signature: string) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_SECRET is not configured.");

  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  return expectedBuffer.length === actualBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export function unixToIso(value?: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}
