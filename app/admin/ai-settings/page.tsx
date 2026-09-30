"use client";

import { useEffect, useState, type FormEvent } from "react";
import AdminNav from "../admin-nav";

const providerOptions = [
  { value: "ollama", label: "Ollama", description: "Local or Cloudflare-tunneled Ollama" },
  { value: "freellmapi", label: "FreeLLMAPI", description: "Your FreeLLMAPI gateway" },
  { value: "openai", label: "OpenAI", description: "OpenAI API" },
  { value: "anthropic", label: "Anthropic", description: "Anthropic Messages API" },
  { value: "google", label: "Google", description: "Google OpenAI-compatible endpoint" },
  { value: "custom", label: "Custom", description: "Any OpenAI-compatible endpoint" },
];

type PublicAIConfig = {
  id: string;
  provider: string;
  baseUrl: string | null;
  model: string;
  apiKeyConfigured: boolean;
  isActive: boolean;
  updatedAt: string;
};

type PublicImageConfig = {
  id: string;
  provider: "freellmapi" | "openai";
  baseUrl: string | null;
  model: string;
  apiKeyConfigured: boolean;
  priority: number;
  isEnabled: boolean;
  updatedAt: string;
};

export default function AISettingsPage() {
  const [config, setConfig] = useState<PublicAIConfig | null>(null);
  const [imageConfigs, setImageConfigs] = useState<PublicImageConfig[]>([]);
  const [imageProvider, setImageProvider] = useState<"freellmapi" | "openai">("freellmapi");
  const [imageBaseUrl, setImageBaseUrl] = useState("");
  const [imageModel, setImageModel] = useState("@cf/black-forest-labs/flux-2-klein-4b");
  const [imageApiKey, setImageApiKey] = useState("");
  const [imagePriority, setImagePriority] = useState("10");
  const [imageEnabled, setImageEnabled] = useState(true);
  const [imageSaving, setImageSaving] = useState(false);
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
      return JSON.parse(text) as {
        error?: string;
        config?: PublicAIConfig;
        ok?: boolean;
        response?: string;
        elapsedMs?: number;
      };
    } catch {
      throw new Error(
        `Request failed (HTTP ${response.status}). The server returned an invalid response.`,
      );
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/admin/ai-config")
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) throw new Error(data.error || "Unable to load AI configuration.");
        if (cancelled) return;

        if (data.config) {
          setConfig(data.config);
          setProvider(data.config.provider);
          setBaseUrl(data.config.baseUrl || "");
          setModel(data.config.model || "");
        } else {
          setModel("qwen2.5:7b");
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Unable to load AI configuration.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    fetch("/api/admin/image-config")
      .then(async (response) => {
        const data = await readResponse(response);
        if (!response.ok) throw new Error(data.error || "Unable to load image configuration.");
        if (cancelled) return;
        const configs = (data as { configs?: PublicImageConfig[] }).configs || [];
        setImageConfigs(configs);
        const first = configs[0];
        if (first) {
          setImageProvider(first.provider);
          setImageBaseUrl(first.baseUrl || "");
          setImageModel(first.model);
          setImagePriority(String(first.priority));
          setImageEnabled(first.isEnabled);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unable to load image configuration.");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(path: string, method: "POST" | "PUT") {
    setError("");
    setMessage("");

    const trimmedModel = model.trim();
    const trimmedBaseUrl = baseUrl.trim();

    if (!trimmedModel) {
      throw new Error("Model is required.");
    }

    if (provider !== "ollama" && provider !== "anthropic" && !trimmedBaseUrl) {
      throw new Error("Base URL is required for this provider.");
    }

    const payload = {
      provider,
      baseUrl: trimmedBaseUrl,
      model: trimmedModel,
      apiKey: apiKey.trim(),
    };

    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.error || `Request failed (HTTP ${response.status}).`);
    }

    return data;
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (saving || testing || loading) return;

    try {
      setSaving(true);
      const data = await submit("/api/admin/ai-config", "POST");
      if (!data.config) throw new Error("The server did not return the saved configuration.");

      setConfig(data.config);
      setApiKey("");
      setMessage("AI configuration saved and activated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  }

  async function saveImageProvider() {
    if (imageSaving || saving || testing || loading) return;
    try {
      setImageSaving(true);
      setError("");
      setMessage("");
      const response = await fetch("/api/admin/image-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: imageProvider,
          baseUrl: imageBaseUrl.trim(),
          model: imageModel.trim(),
          apiKey: imageApiKey.trim(),
          priority: Number(imagePriority),
          isEnabled: imageEnabled,
        }),
      });
      const data = await readResponse(response) as { config?: PublicImageConfig; error?: string };
      if (!response.ok) throw new Error(data.error || "Unable to save image provider.");
      if (!data.config) throw new Error("The server did not return the saved image configuration.");
      setImageConfigs((current) => {
        const rest = current.filter((item) => item.provider !== data.config!.provider);
        return [...rest, data.config!].sort((a, b) => a.priority - b.priority);
      });
      setImageApiKey("");
      setMessage(`${imageProvider === "freellmapi" ? "FreeLLMAPI" : "OpenAI"} image provider saved.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save image provider.");
    } finally {
      setImageSaving(false);
    }
  }

  async function test() {
    if (saving || testing || loading) return;

    try {
      setTesting(true);
      const data = await submit("/api/admin/ai-config", "PUT");
      setMessage(`Connection successful · ${data.elapsedMs ?? 0} ms · ${data.response ?? ""}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection test failed.");
    } finally {
      setTesting(false);
    }
  }

  const selected = providerOptions.find((item) => item.value === provider);
  const needsUrl = provider !== "ollama" && provider !== "anthropic";
  const keyConfiguredForSelectedProvider =
    config?.provider === provider && config.apiKeyConfigured;

  return (
    <main className="min-h-screen bg-[#f7f6f2] text-[#171717]">
      <AdminNav />
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <div className="border-b border-neutral-300 pb-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
            PostCraft AI · administration
          </div>
          <h1 className="mt-3 font-serif text-5xl tracking-[-0.04em]">AI Configuration</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
            Choose the AI provider and model used by PostCraft. Secrets stay on the server and are
            never displayed again.
          </p>
        </div>

        {loading ? (
          <div className="py-10 text-sm text-neutral-500">Loading configuration…</div>
        ) : (
          <form onSubmit={save} className="mt-8 space-y-5">
            <section className="border border-neutral-300 bg-white/60 p-6">
              <label htmlFor="ai-provider" className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                Provider
              </label>
              <select
                id="ai-provider"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value);
                  setError("");
                  setMessage("");
                }}
                className="mt-2 w-full border border-neutral-300 bg-white px-3 py-3 text-sm"
              >
                {providerOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} — {item.description}
                  </option>
                ))}
              </select>
            </section>

            <section className="grid gap-5 border border-neutral-300 bg-white/60 p-6">
              {needsUrl && (
                <label className="grid gap-2" htmlFor="ai-base-url">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    Base URL
                  </span>
                  <input
                    id="ai-base-url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={
                      provider === "freellmapi"
                        ? "https://freellmapi.ninety6ai.online/v1"
                        : "https://api.example.com/v1"
                    }
                    className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                  />
                </label>
              )}

              {provider === "anthropic" && (
                <label className="grid gap-2" htmlFor="ai-anthropic-base-url">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    Base URL (optional)
                  </span>
                  <input
                    id="ai-anthropic-base-url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://api.anthropic.com"
                    className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                  />
                </label>
              )}

              <label className="grid gap-2" htmlFor="ai-model">
                <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                  Model
                </span>
                <input
                  id="ai-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. gpt-oss-120b"
                  className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                />
              </label>

              {provider !== "ollama" && (
                <label className="grid gap-2" htmlFor="ai-api-key">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
                    API key
                  </span>
                  <input
                    id="ai-api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      keyConfiguredForSelectedProvider
                        ? "Configured — leave blank to keep it"
                        : "Enter API key"
                    }
                    autoComplete="new-password"
                    className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                  />
                  {keyConfiguredForSelectedProvider && (
                    <span className="text-xs text-neutral-500">
                      A key is already configured for this provider. Leave this blank to keep it.
                    </span>
                  )}
                </label>
              )}

              <p className="text-xs text-neutral-500">
                Press <kbd className="border border-neutral-300 bg-white px-1.5 py-0.5 font-mono">Enter</kbd>{" "}
                in any field to save and activate this configuration.
              </p>
            </section>

            <section className="flex flex-col gap-3 border border-neutral-300 bg-white/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">{selected?.label}</div>
                <div className="mt-1 text-xs text-neutral-500">
                  {config?.updatedAt
                    ? `Last updated ${new Date(config.updatedAt).toLocaleString("en-IN")}`
                    : "Not configured yet"}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={test}
                  disabled={testing || saving || loading}
                  className="border border-neutral-900 px-4 py-2 text-sm disabled:opacity-50"
                >
                  {testing ? "Testing…" : "Test connection"}
                </button>
                <button
                  type="submit"
                  disabled={saving || testing || loading}
                  className="bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save & activate"}
                </button>
              </div>
            </section>

            <section className="border border-neutral-300 bg-white/60 p-6">
              <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Visual Storytelling · Image Providers</div>
              <h2 className="mt-2 text-xl font-medium">Image generation fallback</h2>
              <p className="mt-2 max-w-2xl text-xs leading-5 text-neutral-500">
                Image generation is independent of the text AI provider. Configure more than one image provider;
                PostCraft tries them in priority order and automatically moves to the next provider when one fails.
              </p>

              <div className="mt-5 grid gap-5">
                <label className="grid gap-2" htmlFor="image-provider">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Provider</span>
                  <select
                    id="image-provider"
                    value={imageProvider}
                    onChange={(e) => {
                      const value = e.target.value as "freellmapi" | "openai";
                      setImageProvider(value);
                      const existing = imageConfigs.find((item) => item.provider === value);
                      setImageBaseUrl(existing?.baseUrl || (value === "openai" ? "https://api.openai.com/v1" : ""));
                      setImageModel(existing?.model || (value === "openai" ? "gpt-image-2" : "@cf/black-forest-labs/flux-2-klein-4b"));
                      setImagePriority(String(existing?.priority ?? (value === "freellmapi" ? 10 : 20)));
                      setImageEnabled(existing?.isEnabled ?? true);
                      setImageApiKey("");
                    }}
                    className="border border-neutral-300 bg-white px-3 py-3 text-sm"
                  >
                    <option value="freellmapi">FreeLLMAPI</option>
                    <option value="openai">OpenAI</option>
                  </select>
                </label>

                <label className="grid gap-2" htmlFor="image-base-url">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Base URL</span>
                  <input
                    id="image-base-url"
                    value={imageBaseUrl}
                    onChange={(e) => setImageBaseUrl(e.target.value)}
                    placeholder={imageProvider === "openai" ? "https://api.openai.com/v1" : "https://freellmapi.ninety6ai.online/v1"}
                    className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                  />
                </label>

                <label className="grid gap-2" htmlFor="image-model">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Image model</span>
                  <input
                    id="image-model"
                    value={imageModel}
                    onChange={(e) => setImageModel(e.target.value)}
                    className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                  />
                </label>

                <div className="grid gap-5 sm:grid-cols-2">
                  <label className="grid gap-2" htmlFor="image-priority">
                    <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">Priority</span>
                    <input
                      id="image-priority"
                      type="number"
                      min="1"
                      max="999"
                      value={imagePriority}
                      onChange={(e) => setImagePriority(e.target.value)}
                      className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-3 self-end border border-neutral-300 bg-white px-3 py-3 text-sm">
                    <input type="checkbox" checked={imageEnabled} onChange={(e) => setImageEnabled(e.target.checked)} />
                    Enabled for fallback
                  </label>
                </div>

                <label className="grid gap-2" htmlFor="image-api-key">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">API key</span>
                  <input
                    id="image-api-key"
                    type="password"
                    value={imageApiKey}
                    onChange={(e) => setImageApiKey(e.target.value)}
                    placeholder={
                      imageConfigs.find((item) => item.provider === imageProvider)?.apiKeyConfigured
                        ? "Configured — leave blank to keep it"
                        : "Enter API key"
                    }
                    autoComplete="new-password"
                    className="border border-neutral-300 bg-white px-3 py-3 font-mono text-sm"
                  />
                </label>

                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-neutral-500">
                    {imageConfigs.length
                      ? imageConfigs.map((item) => `${item.provider}: ${item.isEnabled ? `priority ${item.priority}` : "disabled"}`).join(" · ")
                      : "No image providers configured yet."}
                  </div>
                  <button
                    type="button"
                    onClick={saveImageProvider}
                    disabled={imageSaving || saving || testing || loading}
                    className="bg-neutral-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {imageSaving ? "Saving…" : "Save image provider"}
                  </button>
                </div>
              </div>
            </section>

            {message && <div className="border border-neutral-300 bg-white p-4 text-sm">{message}</div>}
            {error && <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          </form>
        )}
      </div>
    </main>
  );
}
