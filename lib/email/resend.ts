const RESEND_API = "https://api.resend.com/emails";

function getConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const cc = (process.env.RESEND_CC_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  if (!apiKey || !from) {
    throw new Error("Resend is not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL.");
  }

  return { apiKey, from, cc };
}

export async function sendTrialExtendedEmail({
  to,
  name,
  trialEndsAt,
}: {
  to: string;
  name?: string | null;
  trialEndsAt: string;
}) {
  const { apiKey, from, cc } = getConfig();
  const displayName = name?.trim() || "there";
  const endDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "long",
    timeZone: "Asia/Kolkata",
  }).format(new Date(trialEndsAt));

  const response = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      ...(cc.length > 0 ? { cc } : {}),
      subject: "Your PostCraft Pro trial has been extended",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">
        <p>Hi ${escapeHtml(displayName)},</p>
        <p>Your PostCraft Pro trial has been extended.</p>
        <p>Your trial is now available until <strong>${escapeHtml(endDate)}</strong>.</p>
        <p>You can continue using PostCraft during this period.</p>
        <p>— PostCraft Team</p>
      </div>`,
      text: `Hi ${displayName},

Your PostCraft Pro trial has been extended.

Your trial is now available until ${endDate}.

You can continue using PostCraft during this period.

— PostCraft Team`,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend email failed (${response.status}): ${detail.slice(0, 500)}`);
  }

  return response.json();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
