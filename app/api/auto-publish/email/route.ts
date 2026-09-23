import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBillingAccess } from "@/lib/billing/access";

export async function POST(request: Request) {
  try {
    const billing = await getBillingAccess();
    if (!billing.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    if (!billing.allowed) return NextResponse.json({ error: "Start your free trial or subscribe to continue." }, { status: 402 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Your account does not have an email address." }, { status: 400 });

    const body = await request.json();
    const requestedTo = typeof body?.to === "string" ? body.to.trim().toLowerCase() : "";
    const subject = typeof body?.subject === "string" ? body.subject.trim().slice(0, 200) : "PostCraft daily AI post";
    const text = typeof body?.body === "string" ? body.body.trim().slice(0, 20000) : "";

    if (requestedTo && requestedTo !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "Email delivery is restricted to your signed-in account email." }, { status: 403 });
    }
    if (!text) return NextResponse.json({ error: "Email content is empty." }, { status: 400 });

    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!apiKey || !from) {
      return NextResponse.json({ error: "Email delivery is not configured yet." }, { status: 503 });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [user.email], subject, text }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: data?.message || "The email provider rejected the message." }, { status: 502 });

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (error) {
    console.error("Auto-publish email failed:", error);
    return NextResponse.json({ error: "The email could not be sent." }, { status: 500 });
  }
}
