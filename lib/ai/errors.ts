export type AIErrorKind =
  | "not_configured" | "invalid_config" | "missing_api_key" | "invalid_api_key"
  | "tunnel_unavailable" | "gateway_unavailable" | "bad_request" | "rate_limited"
  | "provider_error" | "timeout" | "network" | "malformed_response" | "invalid_json" | "content_invalid";

export class AIProviderError extends Error {
  readonly kind: AIErrorKind; readonly provider: string; readonly status?: number; readonly retryable: boolean; readonly cause?: unknown;
  constructor(kind: AIErrorKind, message: string, options: { provider: string; status?: number; retryable?: boolean; cause?: unknown }) {
    super(message); this.name = "AIProviderError"; this.kind = kind; this.provider = options.provider; this.status = options.status;
    this.retryable = options.retryable ?? false; this.cause = options.cause;
  }
}
export function isAIProviderError(error: unknown): error is AIProviderError { return error instanceof AIProviderError; }
export function httpStatusForAIError(error: unknown) {
  if (!isAIProviderError(error)) return 500;
  switch (error.kind) {
    case "not_configured": case "invalid_config": case "missing_api_key": return 503;
    case "invalid_api_key": return 502;
    case "bad_request": case "content_invalid": return 400;
    case "rate_limited": return 429;
    case "tunnel_unavailable": case "gateway_unavailable": case "network": case "timeout": return 503;
    case "malformed_response": case "invalid_json": return 502;
    default: return 502;
  }
}
export function userFacingAIError(error: unknown) {
  if (!isAIProviderError(error)) return error instanceof Error ? error.message : "AI generation failed. Please try again.";
  switch (error.kind) {
    case "not_configured": return "No AI provider is configured.";
    case "invalid_config": return "The AI provider configuration is invalid.";
    case "missing_api_key": return `${error.provider} API key is not configured.`;
    case "invalid_api_key": return `${error.provider} rejected the configured API key.`;
    case "tunnel_unavailable": return `${error.provider} is temporarily unreachable through Cloudflare. Please try again.`;
    case "gateway_unavailable": case "network": return `${error.provider} is temporarily unavailable. Please try again.`;
    case "timeout": return `${error.provider} took too long to respond. Please try again.`;
    case "bad_request": return `${error.provider} rejected the generation request.`;
    case "rate_limited": return `${error.provider} is rate-limited right now. Please try again shortly.`;
    case "malformed_response": case "invalid_json": return `${error.provider} returned an unusable response. Please try again.`;
    case "content_invalid": return "The AI response did not meet the required content format. Please try again.";
    default: return `${error.provider} could not complete the request. Please try again.`;
  }
}