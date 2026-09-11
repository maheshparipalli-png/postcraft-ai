"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={loading}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
