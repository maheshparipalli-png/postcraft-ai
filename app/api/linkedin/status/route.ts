import { NextRequest, NextResponse } from "next/server";
import { decryptLinkedInSession, linkedinCookieName } from "@/lib/linkedin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ connected: false });

  const value = request.cookies.get(linkedinCookieName())?.value;
  const session = value ? decryptLinkedInSession(value) : null;
  return NextResponse.json({ connected: Boolean(session && session.userId === user.id) });
}
