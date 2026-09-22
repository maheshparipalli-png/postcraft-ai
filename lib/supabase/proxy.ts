import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const publicPaths = ["/", "/login", "/help", "/help/contact"];

function isPublic(pathname: string) {
  return publicPaths.includes(pathname) || pathname.startsWith("/auth/");
}

function isProtected(pathname: string) {
  return ["/create", "/postcard", "/commentcraft", "/workspace", "/auto-post", "/auto-publish"]
    .some((prefix) => pathname === prefix || pathname.startsWith(prefix + "/"));
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) to.headers.set(header, value);
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub as string | undefined;

  if (isPublic(request.nextUrl.pathname)) return response;

  if (!userId) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    copyCookies(response, redirect);
    return redirect;
  }

  if (request.nextUrl.pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (profile?.role !== "admin" && profile?.role !== "super_admin") {
      const redirect = NextResponse.redirect(new URL("/", request.url));
      copyCookies(response, redirect);
      return redirect;
    }
    return response;
  }

  if (request.nextUrl.pathname === "/billing") return response;

  if (isProtected(request.nextUrl.pathname)) {
    const { data: subscription } = await supabase
      .from("billing_subscriptions")
      .select("status,trial_ends_at,grace_ends_at")
      .eq("user_id", userId)
      .maybeSingle();

    const now = Date.now();
    const trialEnds = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at).getTime() : NaN;
    const graceEnds = subscription?.grace_ends_at ? new Date(subscription.grace_ends_at).getTime() : NaN;
    const allowed =
      subscription?.status === "active" ||
      (Number.isFinite(trialEnds) && trialEnds > now) ||
      (Number.isFinite(graceEnds) && graceEnds > now);

    if (!allowed) {
      const redirect = NextResponse.redirect(new URL("/billing", request.url));
      copyCookies(response, redirect);
      return redirect;
    }
  }

  return response;
}
