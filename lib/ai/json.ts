import { AIProviderError } from "./errors";

export function parseJsonObject(text: string, provider = "AI"): Record<string, unknown> {
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  const candidates = [cleaned];
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start && cleaned.slice(start, end + 1) !== cleaned) candidates.push(cleaned.slice(start, end + 1));
  for (const candidate of candidates) {
    try { const parsed: unknown = JSON.parse(candidate); if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>; }
    catch { /* Try recovery candidate. */ }
  }
  throw new AIProviderError("invalid_json", `${provider} returned invalid JSON.`, { provider });
}