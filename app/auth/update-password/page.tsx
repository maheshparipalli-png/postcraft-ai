"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage("Password updated. Redirecting to your workspace…");
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 700);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-950">
        <p className="text-sm font-medium text-neutral-500">PostCraft AI</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-2 text-sm text-neutral-500">Set a new password for your PostCraft account.</p>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium">
            New password
            <input
              type="password"
              minLength={6}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15"
            />
          </label>

          <label className="block text-sm font-medium">
            Confirm password
            <input
              type="password"
              minLength={6}
              required
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15"
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {saving ? "Updating…" : "Update password"}
          </button>
        </form>

        {message && <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300" role="status">{message}</p>}
      </section>
    </main>
  );
}
