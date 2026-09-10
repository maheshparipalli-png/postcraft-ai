"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HomeWorkspaceLink() {
  const pathname = usePathname();
  if (pathname !== "/") return null;

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <Link
        href="/workspace"
        className="rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:border-neutral-900 hover:shadow-md"
      >
        Editorial Workspace →
      </Link>
    </div>
  );
}
