import { NextResponse } from "next/server";
import { linkedinCookieName } from "@/lib/linkedin";

export async function POST() {
  const response = NextResponse.json({ disconnected: true });

  response.cookies.set({
    name: linkedinCookieName(),
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
