"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();

  const [isSignUp, setIsSignUp] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogleLogin() {
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createClient();

    const result = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
      : await supabase.auth.signInWithPassword({
          email,
          password,
        });

    if (result.error) {
      setMessage(result.error.message);
      setLoading(false);
      return;
    }

    if (isSignUp) {
      setMessage(
        "Account created. Check your email and click the confirmation link."
      );
      setLoading(false);
    } else {
      router.push("/");
      router.refresh();
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-neutral-950">
        <p className="text-sm font-medium text-neutral-500">
          PostCraft AI
        </p>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>

        <p className="mt-2 text-sm text-neutral-500">
          Save your ideas and return to your editorial workspace.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-black/5 p-1 dark:bg-white/10">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(true);
              setMessage("");
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              isSignUp
                ? "bg-white shadow-sm dark:bg-neutral-800"
                : "text-neutral-500"
            }`}
          >
            Create account
          </button>

          <button
            type="button"
            onClick={() => {
              setIsSignUp(false);
              setMessage("");
            }}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              !isSignUp
                ? "bg-white shadow-sm dark:bg-neutral-800"
                : "text-neutral-500"
            }`}
          >
            Sign in
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-lg border border-black/15 px-4 py-3 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white font-bold text-blue-600">
            G
          </span>
          Continue with Google
        </button>

        <div className="my-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
          <span className="text-xs text-neutral-500">OR</span>
          <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15"
            />
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2.5 outline-none focus:ring-2 focus:ring-black/20 dark:border-white/15"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-black px-4 py-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
          >
            {loading
              ? "Please wait..."
              : isSignUp
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        {message && (
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">
            {message}
          </p>
        )}

        <div className="mt-6 text-center text-sm text-neutral-600 dark:text-neutral-300">
          {isSignUp ? (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(false);
                  setMessage("");
                }}
                className="font-medium text-black underline underline-offset-4 dark:text-white"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(true);
                  setMessage("");
                }}
                className="font-medium text-black underline underline-offset-4 dark:text-white"
              >
                Sign up
              </button>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
