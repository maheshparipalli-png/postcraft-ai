"use client";

import { useEffect, useState } from "react";
import AdminNav from "../admin-nav";

const providerOptions = [
  { value: "ollama", label: "Ollama", description: "Local or Cloudflare-tunneled Ollama" },
  { value: "freellmapi", label: "FreeLLMAPI", description: "Your FreeLLMAPI gateway" },
  { value: "openai", label: "OpenAI", description: "OpenAI API" },
  { value: "anthropic", label: "Anthropic", description: "Anthropic Messages API" },
  { value: "google", label: "Google", description: "Google OpenAI-compatible endpoint" },
  { value: "custom", label: "Custom", description: "Any OpenAI-compatible endpoint" },
];

export default function AISettingsPage() {
  const [config, setConfig] = useState<any>(null);
  const [provider, setProvider] = useState("ollama");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function readResponse(response: Response) {
    const text = await response.text();
    if (!text.trim()) {
      throw new Error(
        `Request failed (HTTP ${response.status}). The server returned an empty response.`,
      );
    }

    try {
      return JSON.parse(text);
    } catch {
      throw new Error(
        `Request failed (HTTP ${response.status}). The server returned an invalid response.`,
      );
    }
  }

  useEffect(() => {
    fetch("/api/admin/ai-config")
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) throw new Error(data.error || "Unable to load AI configuration.");
        if (data.config) {
          setConfig(data.config);
          setProvider(data.config.provider);
          setBaseUrl(data.config.baseUrl || "");
          setModel(data.config.model || "");
        } else {
          setModel("qwen2.5:7b");
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load AI configuration."))
      .finally(() => setLoading(false));
  }, []);

  async function submit(path: string, method: "POST" | "PUT") {
    setError("");
    setMessage("");

    if (!model.trim()) {
      throw new Error("Model is required.");
    }

    if (provider !== "ollama" && provider !== "anthropic" && !baseUrl.trim()) {
      throw new Error("Base URL is required for this provider.");
    }

    const payload = { provider, baseUrl, model, apiKey };
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readResponse(response);
    if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    return data;
  }

  async function save() {
    try {
      setSaving(true);
      const data = await submit("/api/admin/ai-config", "POST");
      setConfig(data.config);
      setApiKey("");
      setMessage("AI configuration saved and activated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    try {
      setTesting(true);
      const data = await submit("/api/admin/ai-config", "PUT");
      setMessage(`Connection successful · ${data.elapsedMs} ms · ${data.response}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  const selected = providerOptions.find((item) => item.value === provider);
  const needsUrl = provider !== "ollama" && provider !== "anthropic";

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <AdminNav />
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <div className="border-b border-neutral-300 pb-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">PostCraft AI · administration</div>
          <h1 className="mt-3 font-serif text-5xl tracking-[-0.04em]">AI Configuration</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">Choose the AI provider and model used by PostCraft. Secrets stay on the server and are never displayed again.</p>
        </div>

        {loading ? <div className="py-10 text-sm text-neutral-500">Loading configuration…</div> : (
          <div className="mt-8 space-y-5">
            <section className="border border-neutral-300 bg-white/60 p-6">
              <label className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Provider</label>
              <select value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-2 w-full border border-neutral-300 bg-white px-3 py-3 text-sm">
                {providerOptions.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.description}</option>)}
              </select>
            </section>

            <section className="grid gap-5 border border-neutral-300 bg-white/60 p-6">
              {needsUrl && (
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Base URL</span>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={provider === "freellmapi" ? "https://your-gateway.example.com/v1" : "https://api.example.com/v1"} className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm" />
                </label>
              )}
              {provider === "anthropic" && (
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Base URL (optional)</span>
                  <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.anthropic.com" className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm" />
                </label>
              )}
              <label className="grid gap-2">
                <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Model</span>
                <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="e.g. gpt-oss-120b" className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm" />
              </label>
              {provider !== "ollama" && (
                <label className="grid gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">API key</span>
                  <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={config?.apiKey ? "Configured — leave blank to keep it" : "Enter API key"} autoComplete="new-password" className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm" />
                  {config?.apiKey && <span className="text-xs text-neutral-500">A key is already configured. Leave this blank to keep the existing key.</span>}
                </label>
              )}
            </section>

            <section className="flex flex-col gap-3 border border-neutral-300 bg-white/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">{selected?.label}</div>
                <div className="mt-1 text-xs text-neutral-500">{config?.updatedAt ? `Last updated ${new Date(config.updatedAt).toLocaleString("en-IN")}` : "Not configured yet"}</div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button onClick={test} disabled={testing || loading} className="border border-neutral-900 px-4 py-2 text-sm disabled:opacity-50">{testing ? "Testing…" : "Test connection"}</button>
                <button onClick={save} disabled={saving || loading} className="bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save & activate"}</button>
              </div>
            </section>

            {message && <div className="border border-neutral-300 bg-white p-4 text-sm">{message}</div>}
            {error && <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          </div>
        )}
      </div>
    </main>
  );
}
