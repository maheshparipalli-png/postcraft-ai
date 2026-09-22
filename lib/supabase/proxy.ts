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

function isAuthorizedCron(request: NextRequest, pathname: string) {
  if (pathname !== "/api/auto-publish/run") return false;
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
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

  const pathname = request.nextUrl.pathname;
  const isApiRoute = pathname.startsWith("/api/");
  const isBillingApi = pathname.startsWith("/api/billing/");
  const isAdminRoute = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin/");
  const isCronRequest = isAuthorizedCron(request, pathname);

  if (!isApiRoute && isPublic(pathname)) return response;

  if (!userId && isCronRequest) return response;

  if (!userId) {
    if (isApiRoute) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    copyCookies(response, redirect);
    return redirect;
  }

  if (isAdminRoute || isAdminApi) {
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

  if (pathname === "/billing" || isBillingApi) return response;

  if (isProtected(pathname) || (isApiRoute && !isBillingApi)) {
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
      (subscription?.status === "trialing" && Number.isFinite(trialEnds) && trialEnds > now) ||
      (subscription?.status === "grace" && Number.isFinite(graceEnds) && graceEnds > now);

    if (!allowed) {
      if (isApiRoute) {
        return NextResponse.json({ error: "Start your free trial or subscribe to continue", billingStatus: "expired" }, { status: 402 });
      }
      const redirect = NextResponse.redirect(new URL("/billing", request.url));
      copyCookies(response, redirect);
      return redirect;
    }
  }

  return response;
}
