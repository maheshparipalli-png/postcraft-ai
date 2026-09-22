"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadAuth() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!active) return;
        setSignedIn(Boolean(user));
        if (user) {
          const { data: profile } = await supabase.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
          if (active) setIsAdmin(profile?.role === "admin" || profile?.role === "super_admin");
        }
      } finally {
        if (active) setAuthReady(true);
      }
    }
    void loadAuth();
    return () => { active = false; };
  }, []);

  if (pathname === "/login") return null;

  const publishActive = pathname === "/auto-post" || pathname === "/auto-publish";
  const helpActive = pathname === "/help" || pathname.startsWith("/help/");
  const accountActive = pathname === "/billing" || pathname.startsWith("/admin");

  return (
    <header className="postcraft-site-nav sticky top-0 z-50 border-b border-neutral-300/80 bg-[#f7f6f2]/95 backdrop-blur">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-4">
          <Link href="/" onClick={() => setMobileOpen(false)} className="shrink-0 font-serif text-[21px] font-semibold tracking-[-0.04em] text-neutral-950">
            POSTCRAFT
          </Link>

          {!authReady || signedIn ? (
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary navigation">
            {primaryLinks.map((link) => {
              const active = isActive(pathname, link);
              return (
                <Link key={link.href} href={link.href} className={active ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white" : "rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}>
                  {link.label}
                </Link>
              );
            })}

            <details className="group relative">
              <summary className={publishActive ? "list-none rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white" : "list-none rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}>
                Publish <span className="ml-1 text-[10px]">⌄</span>
              </summary>
              <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
                <Link href="/auto-post" className={pathname === "/auto-post" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>
                  Auto-post
                  <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">Prepare &amp; review</span>
                </Link>
                <Link href="/auto-publish" className={pathname === "/auto-publish" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>
                  Auto-publish
                  <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">Recurring automation</span>
                </Link>
              </div>
            </details>

            <details className="group relative">
              <summary className={helpActive ? "list-none rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white" : "list-none rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}>
                Help <span className="ml-1 text-[10px]">⌄</span>
              </summary>
              <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
                <Link href="/help" className={pathname === "/help" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>Help Center</Link>
                <Link href="/help/contact" className={pathname === "/help/contact" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>Contact Support</Link>
              </div>
            </details>

            <details className="group relative">
              <summary className={accountActive ? "list-none rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white" : "list-none rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}>
                Account <span className="ml-1 text-[10px]">⌄</span>
              </summary>
              <div className="absolute right-0 top-full mt-2 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg">
                <Link href="/billing" className={pathname === "/billing" ? "block rounded-lg bg-neutral-100 px-3 py-2.5 text-xs font-semibold" : "block rounded-lg px-3 py-2.5 text-xs hover:bg-neutral-50"}>
                  Billing
                  <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">Plan &amp; trial</span>
                </Link>
              </div>
            </details>
            {isAdmin && (
              <Link href="/admin" className={pathname.startsWith("/admin") ? "rounded-full bg-neutral-900 px-3.5 py-2 text-xs font-medium text-white" : "rounded-full px-3.5 py-2 text-xs font-medium text-neutral-600 transition hover:bg-neutral-200/70 hover:text-neutral-950"}>
                Admin
              </Link>
            )}
          </nav>
          ) : (
            <div className="hidden items-center gap-4 lg:flex">
              <Link href="/login" className="text-xs font-medium text-neutral-600 hover:text-neutral-950">Sign in</Link>
              <Link href="/login" className="rounded-full bg-neutral-900 px-4 py-2 text-xs font-medium text-white">Start free trial</Link>
            </div>
          )}

          <button type="button" className="rounded-full border border-neutral-300 px-3 py-2 text-xs font-medium lg:hidden" aria-expanded={mobileOpen} aria-controls="postcraft-mobile-navigation" onClick={() => setMobileOpen((open) => !open)}>
            {mobileOpen ? "Close" : "Menu"}
          </button>
        </div>

        {mobileOpen && (
          <div id="postcraft-mobile-navigation" className="border-t border-neutral-200 py-3 lg:hidden">
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
                <Link href="/billing" onClick={() => setMobileOpen(false)} className={pathname === "/billing" ? "block rounded-lg bg-neutral-900 px-3 py-2.5 text-sm text-white" : "block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100"}>Billing</Link>
                <Link href="/help" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100">Help Center</Link>
                <Link href="/help/contact" onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-100">Contact Support</Link>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
