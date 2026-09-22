"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NavLink = { label: string; href: string; exact?: boolean };

const primaryLinks: NavLink[] = [
  { label: "Discover", href: "/", exact: true },
  { label: "Write", href: "/create" },
  { label: "PostCard", href: "/postcard" },
  { label: "CommentCraft", href: "/commentcraft" },
  { label: "Workspace", href: "/workspace" },
];

function isActive(pathname: string, link: NavLink) {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(link.href + "/");
}

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [trialLabel, setTrialLabel] = useState("");
  const [linkedinConnected, setLinkedinConnected] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const publishRef = useRef<HTMLDivElement>(null);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;

    async function loadAuth() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!active) return;
        setSignedIn(Boolean(user));
        setUserEmail(user?.email ?? "");

        if (user) {
          const [{ data: profile }, linkedinResponse, billingResponse] = await Promise.all([
            supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle(),
            fetch("/api/linkedin/status", { cache: "no-store" }),
            fetch("/api/billing/status", { cache: "no-store" }),
          ]);

          if (!active) return;

          setIsAdmin(profile?.role === "admin" || profile?.role === "super_admin");

          const linkedin = await linkedinResponse.json().catch(() => ({}));
          setLinkedinConnected(Boolean(linkedin?.connected));

          const billing = await billingResponse.json().catch(() => ({}));
          if (billing?.status === "trialing" && billing?.subscription?.trial_ends_at) {
            const days = Math.max(
              0,
              Math.ceil((new Date(billing.subscription.trial_ends_at).getTime() - Date.now()) / 86400000),
            );
            setTrialLabel(days === 1 ? "1 day left" : `${days} days left`);
          } else if (billing?.status === "grace") {
            setTrialLabel("Grace period");
          } else if (billing?.status === "active") {
            setTrialLabel("Pro");
          } else if (billing?.status === "expired") {
            setTrialLabel("Trial ended");
          } else {
            setTrialLabel("Start trial");
          }
        }
      } finally {
        if (active) setAuthReady(true);
      }
    }

    void loadAuth();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!accountOpen && !publishOpen && !helpOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (accountOpen && accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false);
      }
      if (publishOpen && publishRef.current && !publishRef.current.contains(target)) {
        setPublishOpen(false);
      }
      if (helpOpen && helpRef.current && !helpRef.current.contains(target)) {
        setHelpOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setPublishOpen(false);
        setHelpOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountOpen, publishOpen, helpOpen]);

  if (pathname === "/login") return null;

  const publishActive = pathname === "/auto-post" || pathname === "/auto-publish";
  const helpActive = pathname === "/help" || pathname.startsWith("/help/");
  const accountActive = pathname === "/billing" || pathname.startsWith("/admin");

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut({ scope: "local" });
    setSignedIn(false);
    setMobileOpen(false);
    router.push("/login");
    router.refresh();
  }

  async function disconnectLinkedIn() {
    await fetch("/api/linkedin/disconnect", { method: "POST" });
    setLinkedinConnected(false);
    setMobileOpen(false);
    router.refresh();
  }

  return (
    <header className="postcraft-site-nav sticky top-0 z-50 border-b border-neutral-300/80 bg-[#f7f6f2]/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-4">
          <Link href="/" onClick={() => setMobileOpen(false)} className="shrink-0 font-serif text-[21px] font-semibold tracking-[-0.04em] text-neutral-950">
            POSTCRAFT
          </Link>

          {!authReady || signedIn ? (
            <div className="hidden items-center gap-2 lg:flex">
              {trialLabel && (
                <Link href="/billing" className="rounded-full border border-neutral-300 px-3 py-2 text-[10px] font-medium text-neutral-600 hover:border-neutral-900 hover:text-neutral-950">
                  {trialLabel}
                </Link>
              )}

              <nav className="flex items-center gap-1" aria-label="Primary navigation">
                {primaryLinks.map((link) => {
                  const active = isActive(pathname, link);
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={active
                        ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white"
                        : "rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}
                    >
                      {link.label}
                    </Link>
                  );
                })}

                <div ref={publishRef} className="relative">
                  <button
                    type="button"
                    aria-expanded={publishOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      setPublishOpen((open) => !open);
                      setHelpOpen(false);
                      setAccountOpen(false);
                    }}
                    className={publishActive || publishOpen
                      ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white"
                      : "rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}
                  >
                    Publish <span className="ml-1 text-[10px]">{publishOpen ? "⌃" : "⌄"}</span>
                  </button>
                  {publishOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg" role="menu">
                      <Link href="/auto-post" onClick={() => setPublishOpen(false)} className={pathname === "/auto-post" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>
                        Auto-post
                        <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">Prepare &amp; review</span>
                      </Link>
                      <Link href="/auto-publish" onClick={() => setPublishOpen(false)} className={pathname === "/auto-publish" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>
                        Auto-publish
                        <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">Recurring automation</span>
                      </Link>
                    </div>
                  )}
                </div>

                <div ref={helpRef} className="relative">
                  <button
                    type="button"
                    aria-expanded={helpOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      setHelpOpen((open) => !open);
                      setPublishOpen(false);
                      setAccountOpen(false);
                    }}
                    className={helpActive || helpOpen
                      ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white"
                      : "rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}
                  >
                    Help <span className="ml-1 text-[10px]">{helpOpen ? "⌃" : "⌄"}</span>
                  </button>
                  {helpOpen && (
                    <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg" role="menu">
                      <Link href="/help" onClick={() => setHelpOpen(false)} className={pathname === "/help" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>Help Center</Link>
                      <Link href="/help/contact" onClick={() => setHelpOpen(false)} className={pathname === "/help/contact" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>Contact Support</Link>
                    </div>
                  )}
                </div>

                <div ref={accountRef} className="relative">
                  <button
                    type="button"
                    aria-expanded={accountOpen}
                    aria-haspopup="menu"
                    onClick={() => setAccountOpen((open) => !open)}
                    className={accountActive || accountOpen
                      ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white"
                      : "rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}
                  >
                    Account <span className="ml-1 text-[10px]">{accountOpen ? "⌃" : "⌄"}</span>
                  </button>
                  {accountOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg" role="menu">
                    <div className="px-3 py-2.5">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Signed in as</div>
                      <div className="mt-1 truncate text-xs font-medium text-neutral-800" title={userEmail}>{userEmail || "Signed-in user"}</div>
                    </div>
                    <Link href="/billing" className={pathname === "/billing" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>
                      Billing
                      <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">Plan &amp; trial</span>
                    </Link>

                    <div className="my-1 border-t border-neutral-100" />

                    {linkedinConnected ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg px-3 py-2.5">
                        <span className="text-xs font-medium text-neutral-800">LinkedIn Connected</span>
                        <button type="button" onClick={() => { void disconnectLinkedIn(); setAccountOpen(false); }} className="text-[10px] text-neutral-500 hover:text-neutral-950">
                          Disconnect
                        </button>
                      </div>
                    ) : (
                      <Link href="/api/linkedin/connect" className="block rounded-lg px-3 py-2.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">
                        Connect LinkedIn
                        <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">Enable LinkedIn publishing</span>
                      </Link>
                    )}

                    <div className="my-1 border-t border-neutral-100" />

                    <button
                      type="button"
                      onClick={() => { void signOut(); setAccountOpen(false); }}
                      disabled={signingOut}
                      className="block w-full rounded-lg px-3 py-2.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {signingOut ? "Signing out…" : "Sign out"}
                    </button>
                  </div>
                  )}
                </div>

                {isAdmin && (
                  <Link href="/admin" className={pathname.startsWith("/admin")
                    ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white"
                    : "rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}>
                    Admin
                  </Link>
                )}
              </nav>
            </div>
          ) : (
            <div className="hidden items-center gap-4 lg:flex">
              <Link href="/login" className="text-xs font-medium text-neutral-600 hover:text-neutral-950">Sign in</Link>
              <Link href="/login" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white">Start free trial</Link>
            </div>
          )}

          <button
            type="button"
            className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="postcraft-mobile-navigation"
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>

        {mobileOpen && (
          <div id="postcraft-mobile-navigation" className="border-t border-neutral-200 py-3 lg:hidden">
            {!authReady || signedIn ? (
              <nav className="grid gap-1" aria-label="Mobile navigation">
                {primaryLinks.map((link) => {
                  const active = isActive(pathname, link);
                  return (
                    <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className={active ? "rounded-lg bg-neutral-900 px-3 py-2.5 text-sm font-medium text-white" : "rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100"}>
                      {link.label}
                    </Link>
                  );
                })}

                <div className="mt-2 border-t border-neutral-200 pt-2">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Publish</div>
                  <Link href="/auto-post" onClick={() => setMobileOpen(false)} className={pathname === "/auto-post" ? "block rounded-lg bg-neutral-900 px-3 py-2.5 text-sm text-white" : "block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100"}>Auto-post</Link>
                  <Link href="/auto-publish" onClick={() => setMobileOpen(false)} className={pathname === "/auto-publish" ? "block rounded-lg bg-neutral-900 px-3 py-2.5 text-sm text-white" : "block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100"}>Auto-publish</Link>
                </div>

                <div className="mt-2 border-t border-neutral-200 pt-2">
                  <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Account</div>
                  <div className="px-3 py-2.5"><div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-neutral-400">Signed in as</div><div className="mt-1 truncate text-sm font-medium text-neutral-800" title={userEmail}>{userEmail || "Signed-in user"}</div></div>
                  <Link href="/billing" onClick={() => setMobileOpen(false)} className={pathname === "/billing" ? "block rounded-lg bg-neutral-900 px-3 py-2.5 text-sm text-white" : "block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100"}>Billing</Link>

                  {linkedinConnected ? (
                    <button type="button" onClick={disconnectLinkedIn} className="block w-full rounded-lg px-3 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-100">
                      LinkedIn Connected · Disconnect
                    </button>
                  ) : (
                    <Link href="/api/linkedin/connect" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100">
                      Connect LinkedIn
                    </Link>
                  )}

                  {isAdmin && <Link href="/admin" onClick={() => setMobileOpen(false)} className={pathname.startsWith("/admin") ? "block rounded-lg bg-neutral-900 px-3 py-2.5 text-sm text-white" : "block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100"}>Admin</Link>}
                  <Link href="/help" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100">Help Center</Link>
                  <Link href="/help/contact" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100">Contact Support</Link>

                  <button
                    type="button"
                    onClick={signOut}
                    disabled={signingOut}
                    className="mt-1 block w-full rounded-lg px-3 py-2.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                  >
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </div>
              </nav>
            ) : (
              <div className="grid gap-2">
                <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100">Sign in</Link>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-lg bg-neutral-900 px-3 py-2.5 text-center text-sm font-medium text-white">Start free trial</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
