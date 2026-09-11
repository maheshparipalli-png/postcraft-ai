import { NextResponse } from "next/server";
import { getLinkedInConfig } from "@/lib/linkedin";

export async function GET() {
  try {
    const { clientId, redirectUri } = getLinkedInConfig();
    const state = crypto.randomUUID();
    const scopes = ["openid", "profile", "w_member_social"].join(" ");
    const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", scopes);
    const response = NextResponse.redirect(url);
    response.cookies.set("postcraft_linkedin_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not start LinkedIn authorization." }, { status: 500 });
  }
}
