import { FormEvent, useEffect, useState } from "react";
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

export default function AISettingsPage() {
  const [config, setConfig] = useState<PublicAIConfig | null>(null);
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

            {message && <div className="border border-neutral-300 bg-white p-4 text-sm">{message}</div>}
            {error && <div className="border border-red-300 bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          </form>
        )}
      </div>
    </main>
  );
}
