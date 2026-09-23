import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const type = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const flowId = requestUrl.searchParams.get("sb_flow_id");
  const next = safeNextPath(requestUrl.searchParams.get("next"));

  if (!code && !(tokenHash && type)) {
    return NextResponse.redirect(new URL("/login?error=missing_auth_code", requestUrl.origin));
  }

  const supabase = await createClient();

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      )
    : await supabase.auth.verifyOtp({
        token_hash: tokenHash as string,
        type: type as EmailOtpType,
      });

  if (error) {
    console.error("Supabase auth callback failed:", {
      code: error.code,
      message: error.message,
      status: error.status,
    });

    const errorUrl = new URL("/login", requestUrl.origin);
    errorUrl.searchParams.set("error", "auth_callback_failed");
    if (error.code) errorUrl.searchParams.set("error_code", error.code);
    if (error.message) errorUrl.searchParams.set("error_message", error.message.slice(0, 180));
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
