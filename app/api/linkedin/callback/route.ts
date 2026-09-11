import { NextRequest, NextResponse } from "next/server";
import { encryptLinkedInSession, getLinkedInConfig, linkedinCookieName } from "@/lib/linkedin";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const expectedState = request.cookies.get("postcraft_linkedin_state")?.value;
  const error = params.get("error");

  if (error) return NextResponse.redirect(new URL(`/?linkedinError=${encodeURIComponent(params.get("error_description") || error)}`, request.url));
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?linkedinError=LinkedIn authorization could not be verified.", request.url));
  }

  try {
    const { clientId, clientSecret, redirectUri } = getLinkedInConfig();
    const tokenResponse = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }),
    });
    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_description || "LinkedIn did not return an access token.");

    const profileResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileResponse.json();
    if (!profileResponse.ok || !profile.sub) throw new Error("Could not retrieve the LinkedIn member profile.");

    const session = encryptLinkedInSession({
      accessToken: tokenData.access_token,
      expiresAt: Date.now() + Number(tokenData.expires_in || 5184000) * 1000,
      personUrn: `urn:li:person:${profile.sub}`,
    });
    const response = NextResponse.redirect(new URL("/?linkedinConnected=1", request.url));
    response.cookies.set(linkedinCookieName(), session, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: Number(tokenData.expires_in || 5184000),
      path: "/",
    });
    response.cookies.delete("postcraft_linkedin_state");
    return response;
  } catch (err) {
    return NextResponse.redirect(new URL(`/?linkedinError=${encodeURIComponent(err instanceof Error ? err.message : "LinkedIn connection failed.")}`, request.url));
  }
}
