import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const to = typeof body?.to === "string" ? body.to.trim() : "";
    const subject = typeof body?.subject === "string" ? body.subject.trim() : "PostCraft daily AI post";
    const text = typeof body?.body === "string" ? body.body.trim() : "";

    if (!to || !/^\S+@\S+\.\S+$/.test(to)) {
      return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Email content is empty." }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      return NextResponse.json({ error: "Email delivery is not configured yet. Add RESEND_API_KEY and EMAIL_FROM to the server environment." }, { status: 503 });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || "The email provider rejected the message." }, { status: 502 });
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (error) {
    console.error("Auto-publish email failed:", error);
    return NextResponse.json({ error: "The email could not be sent." }, { status: 500 });
  }
}
