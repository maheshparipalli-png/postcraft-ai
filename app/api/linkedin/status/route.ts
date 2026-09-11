import { NextRequest, NextResponse } from "next/server";
import { decryptLinkedInSession, linkedinCookieName } from "@/lib/linkedin";

export async function GET(request: NextRequest) {
  const value = request.cookies.get(linkedinCookieName())?.value;
  return NextResponse.json({ connected: Boolean(value && decryptLinkedInSession(value)) });
}
