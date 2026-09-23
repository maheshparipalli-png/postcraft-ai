"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  ["Control room", "/admin"],
  ["Users", "/admin/users"],
  ["Audit log", "/admin/audit"],
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-neutral-300 bg-[#f7f6f2]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-5 py-2 sm:px-8">
        <span className="mr-3 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Admin</span>
        {links.map(([label, href]) => {
          const active = href === "/admin" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap px-3 py-2 text-xs transition ${active ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-white hover:text-neutral-900"}`}
            >
              {label}
            </Link>
          );
        })}
        <Link href="/" className="ml-auto whitespace-nowrap px-3 py-2 text-xs text-neutral-500 hover:text-neutral-900">Exit admin →</Link>
      </div>
    </nav>
  );
}
