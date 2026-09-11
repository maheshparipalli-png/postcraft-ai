 "use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
  }

  if (email) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="hidden max-w-48 truncate text-neutral-500 sm:inline">{email}</span>
        <button onClick={signOut} className="rounded-full border border-black/15 px-3 py-1.5 dark:border-white/15">
          Sign out
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => router.push("/login")} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-black">
      Sign in
    </button>
  );
}
