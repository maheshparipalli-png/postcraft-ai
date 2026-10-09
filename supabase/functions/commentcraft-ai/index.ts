import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildGenerationPrompt, buildRefinePrompt } from './prompt.mjs';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

type SocialPlatform = 'linkedin' | 'x' | 'instagram' | 'facebook' | 'youtube' | 'reddit' | 'threads' | 'tiktok';
type GenerationAngle = 'agree-specific-point' | 'partial-agreement' | 'challenge-assumption' | 'different-perspective' | 'overlooked-consequence' | 'practical-example' | 'cross-domain-connection' | 'deeper-question' | 'limitation' | 'real-world-outcome' | 'contradiction' | 'counterexample';
type PreviousResponse = { comment_text: string; generation_angle: GenerationAngle | null };
type GenerationPlan = { angles: GenerationAngle[]; previousResponses: PreviousResponse[] };

type RequestBody = {
  action: 'generate' | 'suggest' | 'refine' | 'summarize';
  post?: string;
  content_url?: string;
  platform?: SocialPlatform;
  position?: string;
  styles?: string[];
  depth?: string;
  keywords?: string[];
  comment?: string;
  instruction?: string;
  count?: number;
  image_base64?: string;
  image_mime_type?: string;
  file_base64?: string;
  file_mime_type?: string;
  file_name?: string;
};

type Comment = { comment_text: string; quality_score: number; why_it_works: string; generation_angle?: GenerationAngle | null };

const MODEL = 'gemini-3.8-flash';
const FREE_LLM_BASE_URL = 'https://freellmapi.ninety6ai.online/v1';

function decodeBase64Bytes(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function decryptFreeLLMAPIKey(value: string, secret: string) {
  const rawKey = decodeBase64Bytes(secret);
  if (rawKey.length !== 32) throw new Error('FreeLLMAPI encryption is not configured correctly.');
  const key = await crypto.subtle.importKey('raw', rawKey, { name: 'AES-GCM' }, false, ['decrypt']);
  const [ivText, cipherText] = value.split('.');
  if (!ivText || !cipherText) throw new Error('Stored FreeLLMAPI credential is invalid.');
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64Bytes(ivText) },
    key,
    decodeBase64Bytes(cipherText),
  );
  return new TextDecoder().decode(clear);
}

function hasGeminiMedia(body: RequestBody) {
  return Boolean(body.image_base64 || (body.file_base64 && body.file_mime_type === 'application/pdf'));
}

// FreeLLMAPI activation is controlled by the admin provider configuration.
// Keep media on Gemini because OpenAI-compatible PDF/image support is not yet
// verified for this deployment.
async function getFreeLLMAPIConfig(body: RequestBody) {
  if (hasGeminiMedia(body)) return null;
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const encryptionSecret = Deno.env.get('FREELLMAPI_ENCRYPTION_KEY');
  if (!url || !serviceRoleKey || !encryptionSecret) return null;
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from('ai_provider_configs')
    .select('base_url,model,encrypted_api_key,last_test_status,is_active')
    .eq('provider', 'freellmapi')
    .maybeSingle();
  if (error) {
    console.error('FreeLLMAPI runtime configuration lookup failed:', { code: error.code, message: error.message });
    return null;
  }
  if (!data?.encrypted_api_key || data.last_test_status !== 'success' || data.is_active !== true) return null;
  const baseUrl = typeof data.base_url === 'string' ? data.base_url.replace(/\/$/, '') : FREE_LLM_BASE_URL;
  if (baseUrl !== FREE_LLM_BASE_URL) {
    console.error('FreeLLMAPI runtime configuration rejected an unexpected base URL.');
    return null;
  }
  try {
    return {
      baseUrl,
      model: typeof data.model === 'string' && data.model.trim() ? data.model.trim() : 'auto:smart',
      apiKey: await decryptFreeLLMAPIKey(data.encrypted_api_key, encryptionSecret),
    };
  } catch (error) {
    console.error('FreeLLMAPI credential could not be decrypted:', error instanceof Error ? error.message : 'unknown error');
    return null;
  }
}

async function callFreeLLMAPI(prompt: string, body: RequestBody, jsonMode = false) {
  const config = await getFreeLLMAPIConfig(body);
  if (!config) throw new Error('FreeLLMAPI is not enabled or has not passed its connection test.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    let lastJsonError: Error | null = null;
    // JSON-mode responses are validated before returning so truncated output can
    // receive one focused retry instead of immediately falling back to Gemini.
    for (let attempt = 1; attempt <= (jsonMode ? 2 : 1); attempt++) {
      const retryPrompt = attempt === 1 ? prompt : `${prompt}

Your previous response was not complete valid JSON. Return a compact, complete JSON object only. Do not add explanations or Markdown fences. Ensure every string and array is closed, and finish the entire response.`;
      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        redirect: 'error',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'system', content: jsonMode ? 'Return only complete, valid JSON. Do not use Markdown fences or explanatory text. Keep the output concise enough to finish within the token limit.' : 'Follow the user instruction precisely and do not invent facts.' }, { role: 'user', content: retryPrompt }],
          max_tokens: jsonMode ? 3000 : 2200,
          temperature: attempt > 1 ? 0.1 : 0.4,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = response.status === 401 || response.status === 403
          ? 'FreeLLMAPI authentication failed. Check the saved provider configuration.'
          : 'FreeLLMAPI returned HTTP ' + response.status + '.';
        throw new Error(message);
      }
      const responseContent = data?.choices?.[0]?.message?.content;
      const text = typeof responseContent === 'string'
        ? responseContent
        : Array.isArray(responseContent) ? responseContent.map((part: any) => typeof part?.text === 'string' ? part.text : '').join('') : '';
      if (!text.trim()) throw new Error('FreeLLMAPI returned no text.');
      if (!jsonMode) return text.trim();
      try {
        parseJson(text.trim());
        return text.trim();
      } catch (error) {
        lastJsonError = error instanceof Error ? error : new Error(String(error));
        console.warn('FreeLLMAPI returned invalid JSON; retrying once:', lastJsonError.message);
      }
    }
    throw new Error('FreeLLMAPI returned incomplete or invalid JSON after retry.');
  } finally {
    clearTimeout(timeout);
  }
}

const MAX_COMMENT_COUNT = 5;
const MAX_PREVIOUS_RESPONSES = 12;
const MAX_SOURCE_CHARS = 60_000;

const angleLabels: Record<GenerationAngle, string> = {
  'agree-specific-point': 'Agree with one specific point and extend it with a useful observation',
  'partial-agreement': 'Partially agree while adding an important condition or nuance',
  'challenge-assumption': 'Challenge an assumption behind the post constructively',
  'different-perspective': 'Add a perspective the post does not directly cover',
  'overlooked-consequence': 'Identify an overlooked second-order consequence',
  'practical-example': 'Give a concrete, relevant real-world example',
  'cross-domain-connection': 'Connect the idea to a different but relevant domain',
  'deeper-question': 'Ask a deeper question that moves the discussion forward',
  limitation: 'Identify a meaningful limitation or boundary condition',
  'real-world-outcome': 'Explain how this plays out in real-world practice',
  contradiction: 'Point out a respectful tension or contradiction',
  counterexample: 'Offer a relevant counterexample that sharpens the idea',
};
const allAngles = Object.keys(angleLabels) as GenerationAngle[];

const platformGuidance: Record<SocialPlatform, string> = {
  linkedin: 'Professional but conversational. Add a useful observation, nuance, practical implication, experience, or constructive counterpoint. Avoid corporate jargon, motivational clichÃƒÂ©s, networking language, and generic praise.',
  x: 'Short and sharp. Lead with the interesting thought. Favor a clear opinion, contrast, observation, or concise argument.',
  instagram: 'Conversational and relatable. React to the actual content or visual when relevant. Keep it concise and natural.',
  facebook: 'Natural and accessible. Personal, community, practical, or experience-based perspectives can work well.',
  youtube: 'Show that the actual content was understood. Add analysis, context, practical experience, a counterpoint, or a meaningful question.',
  reddit: 'Substantive and specific. Explain reasoning when useful, acknowledge context and trade-offs, and avoid promotional language or shallow agreement.',
  threads: 'Conversational and opinion-driven. Sound like someone naturally joining an ongoing discussion.',
  tiktok: 'Immediate, punchy, relatable, and conversational. Get to the point quickly. Humor can work when it naturally fits.',
};
const platformLabels: Record<SocialPlatform, string> = {
  linkedin: 'LinkedIn', x: 'X', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', reddit: 'Reddit', threads: 'Threads', tiktok: 'TikTok',
};

const clean = (value: string) => value.replace(/\s+/g, ' ').trim();
const normalize = (value: string) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
const clampSource = (value: string) => value.slice(0, MAX_SOURCE_CHARS);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function similarityTokens(value: string) {
  return normalize(value).split(/[^\p{L}\p{N}]+/u).filter((word) => word.length > 2);
}
function tokenSimilarity(left: string, right: string) {
  const a = new Set(similarityTokens(left));
  const b = new Set(similarityTokens(right));
  if (!a.size || !b.size) return 0;
  const overlap = [...a].filter((word) => b.has(word)).length;
  return overlap / (a.size + b.size - overlap);
}
function opening(value: string) { return similarityTokens(value).slice(0, 8).join(' '); }
function isRefineNearDuplicate(candidate: string, existing: string) {
  const a = normalize(candidate);
  const b = normalize(existing);
  if (a === b) return true;
  return tokenSimilarity(candidate, existing) >= 0.88;
}

function isNearDuplicate(candidate: string, existing: string) {
  const a = normalize(candidate);
  const b = normalize(existing);
  if (a === b) return true;
  const score = tokenSimilarity(candidate, existing);
  return score >= 0.72 || (score >= 0.52 && opening(candidate) === opening(existing));
}

function preferredAngles(body: RequestBody) {
  const byPosition: Record<string, GenerationAngle[]> = {
    Agree: ['agree-specific-point', 'practical-example', 'real-world-outcome', 'deeper-question'],
    'Partially Agree': ['partial-agreement', 'limitation', 'practical-example', 'deeper-question'],
    Disagree: ['challenge-assumption', 'counterexample', 'contradiction', 'real-world-outcome'],
    'Add a Different Perspective': ['different-perspective', 'cross-domain-connection', 'overlooked-consequence', 'practical-example'],
    'Challenge the Assumption': ['challenge-assumption', 'contradiction', 'limitation', 'counterexample'],
    'Ask a Question': ['deeper-question', 'overlooked-consequence', 'limitation', 'different-perspective'],
  };
  const styles = body.styles ?? [];
  const styleBoost: GenerationAngle[] = [];
  if (styles.includes('Thought-Provoking')) styleBoost.push('deeper-question');
  if (styles.includes('Bold')) styleBoost.push('challenge-assumption', 'contradiction');
  if (body.depth === 'High') styleBoost.push('cross-domain-connection', 'overlooked-consequence', 'limitation');
  if (body.platform === 'reddit') styleBoost.push('counterexample', 'real-world-outcome');
  if (body.platform === 'x' || body.platform === 'tiktok') styleBoost.push('contradiction', 'agree-specific-point');
  return [...styleBoost, ...(byPosition[body.position ?? 'Agree'] ?? byPosition.Agree), ...allAngles]
    .filter((angle, index, list) => list.indexOf(angle) === index);
}

function selectAngles(body: RequestBody, previous: PreviousResponse[], count: number) {
  const used = new Set(previous.map((item) => item.generation_angle).filter(Boolean));
  const ranked = preferredAngles(body);
  const unused = ranked.filter((angle) => !used.has(angle));
  return [...unused, ...ranked.filter((angle) => !unused.includes(angle))].slice(0, count);
}

async function loadPreviousResponses(fingerprint: string): Promise<PreviousResponse[]> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) return [];
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client
    .from('generated_comments')
    .select('comment_text, generation_angle, comment_sessions!inner(content_fingerprint)')
    .eq('comment_sessions.content_fingerprint', fingerprint)
    .order('created_at', { ascending: false })
    .limit(MAX_PREVIOUS_RESPONSES);
  if (error) {
    console.error('Uniqueness lookup failed:', error.message);
    return [];
  }
  return (data ?? []).map((row) => ({ comment_text: row.comment_text, generation_angle: row.generation_angle as GenerationAngle | null }));
}

function decodeBase64Text(value: string) {
  try {
    return new TextDecoder().decode(Uint8Array.from(atob(value), (c) => c.charCodeAt(0)));
  } catch {
    return '';
  }
}

function htmlToText(html: string) {
  return clean(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>'));
}

function isPrivateOrReservedAddress(hostname: string) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      host === 'metadata.google.internal' || host === 'metadata' || host === '0.0.0.0' ||
      host === '::' || host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) return true;
  // Reject non-public IPv4 literals, including loopback, private, link-local,
  // carrier-grade NAT, benchmarking, multicast, and reserved ranges.
  const parts = host.split('.');
  if (parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)) {
    const [a, b] = parts.map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 || (a === 192 && b === 0);
  }
  // Reject IPv4-mapped IPv6 literals as well.
  if (host.startsWith('::ffff:')) return true;
  return false;
}

async function fetchUrlText(rawUrl: string) {
  if (!rawUrl) return '';
  if (rawUrl.length > 2048) throw new Error('That URL is too long');
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error('Only public HTTP and HTTPS URLs are supported');
  }
  if (isPrivateOrReservedAddress(parsed.hostname)) throw new Error('That URL is not allowed');
  // Do not follow redirects: a public URL must not redirect the function to an
  // internal host or cloud metadata endpoint.
  const response = await fetch(parsed.toString(), {
    headers: { 'User-Agent': 'CommentCraft/1.0' },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Unable to read URL (${response.status})`);
  const type = response.headers.get('content-type') ?? '';
  if (!type.includes('text/html') && !type.includes('text/plain')) throw new Error('The URL does not contain readable text');
  const raw = await response.text();
  if (raw.length > 1_000_000) throw new Error('The linked page is too large to process');
  return clampSource(type.includes('html') ? htmlToText(raw) : clean(raw));
}

async function resolveSource(body: RequestBody) {
  const textParts: string[] = [];
  if (body.post?.trim()) textParts.push(`POST TEXT:\n${body.post.trim()}`);
  if (body.content_url?.trim()) {
    try {
      const urlText = await fetchUrlText(body.content_url.trim());
      if (urlText) textParts.push(`LINKED CONTENT FROM ${body.content_url.trim()}:\n${urlText}`);
    } catch (error) {
      if (!body.post?.trim() && !body.image_base64 && !body.file_base64) throw error;
      console.error('URL fetch skipped:', error instanceof Error ? error.message : error);
      textParts.push(`SOURCE URL: ${body.content_url.trim()} (linked page could not be fetched)`);
    }
  }
  if (body.file_base64 && body.file_mime_type === 'text/plain') {
    const text = decodeBase64Text(body.file_base64);
    if (text) textParts.push(`ATTACHED TEXT FILE (${body.file_name ?? 'file'}):\n${clampSource(text)}`);
  }
  if (body.file_base64 && body.file_mime_type && body.file_mime_type !== 'text/plain') {
    textParts.push(`ATTACHED FILE: ${body.file_name ?? 'file'} (${body.file_mime_type}). The binary file is supplied separately to the model.`);
  }
  return clean(textParts.join('\n\n'));
}

function mediaParts(body: RequestBody) {
  const parts: Array<Record<string, unknown>> = [];
  if (body.image_base64 && body.image_mime_type) {
    parts.push({ inline_data: { mime_type: body.image_mime_type, data: body.image_base64 } });
  }
  if (body.file_base64 && body.file_mime_type === 'application/pdf') {
    parts.push({ inline_data: { mime_type: body.file_mime_type, data: body.file_base64 } });
  }
  return parts;
}

function parseJson(text: string) {
  const cleaned = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  // Some OpenAI-compatible providers prepend a short explanation even when
  // asked for JSON. Extract the first complete JSON object/array without
  // accepting braces that occur inside quoted strings.
  const start = cleaned.search(/[\[{]/);
  if (start < 0) throw new Error('AI response did not contain JSON.');

  const opening = cleaned[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
    const char = cleaned[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === opening) depth++;
    else if (char === closing) {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
    }
  }

  throw new Error('AI response contained incomplete JSON.');
}

function normalizeComments(value: unknown): Comment[] {
  if (!Array.isArray(value)) throw new Error('AI returned an invalid comment format');
  return value.map((item: any) => {
    const commentText = clean(String(item?.comment_text ?? ''));
    if (!commentText) throw new Error('AI returned an empty comment');
    let score = Number(item?.quality_score);
    if (!Number.isFinite(score)) score = 82;
    if (score > 0 && score <= 10) score *= 10;
    // Keep model scores useful and conservative.
    score = Math.max(50, Math.min(95, Math.round(score)));
    return { comment_text: commentText, quality_score: score, why_it_works: clean(String(item?.why_it_works ?? '')), generation_angle: null };
  });
}

async function generateWithGemini(body: RequestBody, apiKey: string | undefined, plan: GenerationPlan) {
  const count = Math.min(Math.max(body.count ?? 5, 3), MAX_COMMENT_COUNT);
  const source = clampSource(await resolveSource(body));
  const angleInstructions = plan.angles.map((angle, index) => `${index + 1}. ${angleLabels[angle]}`).join('\n');
  const previous = plan.previousResponses.map((item) => `- ${item.generation_angle ?? 'unknown'}: ${clean(item.comment_text).slice(0, 240)}`).join('\n');
  const prompt = buildGenerationPrompt({ body, source, platformGuidance, angleInstructions, previous, count });
  if (await getFreeLLMAPIConfig(body)) {
    try {
      return normalizeComments(parseJson(await callFreeLLMAPI(prompt, body, true)).comments);
    } catch (error) {
      console.error('FreeLLMAPI comment generation failed:', error instanceof Error ? error.message : error);
      // Do not mask malformed FreeLLMAPI output with a Gemini quota error.
      // The JSON response already received a bounded retry in callFreeLLMAPI.
      if (!apiKey || (error instanceof Error && /incomplete or invalid JSON|incomplete JSON|did not contain JSON/i.test(error.message))) throw error;
    }
  }
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...mediaParts(body)] }], generationConfig: { responseMimeType: 'application/json' } }),
      });
      const data = await response.json();
      if (!response.ok) {
        lastError = new Error(data?.error?.message || `Gemini request failed with status ${response.status}`);
        if (((response.status === 500 || response.status === 503) || (response.status === 429 && !/quota|resource.?exhausted|generate_content_free_tier_requests/i.test(lastError?.message || ""))) && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
          continue;
        }
        throw lastError;
      }
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('AI returned no comments');
      return normalizeComments(parseJson(text).comments);
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
        continue;
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}

async function suggestWithGemini(body: RequestBody, apiKey: string | undefined) {
  const source = clampSource(await resolveSource(body));
  const platform = body.platform ?? 'linkedin';
  const prompt = `Read this source and suggest useful material for writing a social-media comment. Do not invent facts.\n\nSOURCE:\n${source}\n\nPLATFORM: ${platform}\n\nReturn ONLY JSON with exactly this shape: {"coreIdeas":["..."],"possibleAngles":["..."]}. Provide 4-6 concise core ideas and 4-6 genuinely different possible angles that are grounded in the source.`;
  if (await getFreeLLMAPIConfig(body)) {
    try {
      const parsed = parseJson(await callFreeLLMAPI(prompt, body, true));
      return { coreIdeas: Array.isArray(parsed.coreIdeas) ? parsed.coreIdeas.map(clean).filter(Boolean).slice(0, 6) : [], possibleAngles: Array.isArray(parsed.possibleAngles) ? parsed.possibleAngles.map(clean).filter(Boolean).slice(0, 6) : [] };
    } catch (error) {
      console.error('FreeLLMAPI suggestions failed; trying Gemini fallback:', error instanceof Error ? error.message : error);
      if (!apiKey) throw error;
    }
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...mediaParts(body)] }], generationConfig: { responseMimeType: 'application/json' } }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed with status ${response.status}`);
  const parsed = parseJson(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}');
  return { coreIdeas: Array.isArray(parsed.coreIdeas) ? parsed.coreIdeas.map(clean).filter(Boolean).slice(0, 6) : [], possibleAngles: Array.isArray(parsed.possibleAngles) ? parsed.possibleAngles.map(clean).filter(Boolean).slice(0, 6) : [] };
}

async function summarizeWithGemini(body: RequestBody, apiKey: string | undefined) {
  const source = clampSource(await resolveSource(body));
  const prompt = `Summarize the supplied source so someone can understand it before writing a social-media response. Capture the main idea, important claims, examples, nuance, disagreement, or context. Do not invent facts or praise the author. Keep it concise, usually 3-6 sentences. Return only the summary text.\n\nSOURCE:\n${source}`;
  if (await getFreeLLMAPIConfig(body)) {
    try {
      const summary = await callFreeLLMAPI(prompt, body, false);
      if (summary) return summary;
    } catch (error) {
      console.error('FreeLLMAPI summary failed; trying Gemini fallback:', error instanceof Error ? error.message : error);
      if (!apiKey) throw error;
    }
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, ...mediaParts(body)] }] }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Gemini request failed with status ${response.status}`);
  const summary = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!summary) throw new Error('AI returned no summary');
  return summary;
}

async function enforceUniqueness(initial: Comment[], body: RequestBody, apiKey: string | undefined, previous: PreviousResponse[], angles: GenerationAngle[]) {
  const target = Math.min(Math.max(body.count ?? 5, 3), MAX_COMMENT_COUNT);
  const comparison = previous.map((item) => item.comment_text);
  const accepted: Comment[] = [];
  const accept = (comment: Comment, angle: GenerationAngle) => {
    if (comparison.some((existing) => isNearDuplicate(comment.comment_text, existing))) return false;
    if (accepted.some((existing) => isNearDuplicate(comment.comment_text, existing.comment_text))) return false;
    accepted.push({ ...comment, generation_angle: angle });
    comparison.push(comment.comment_text);
    return true;
  };
  initial.forEach((comment, index) => { if (accepted.length < target) accept(comment, angles[index] ?? allAngles[index % allAngles.length]); });
  let attempts = 0;
  while (accepted.length < target && (apiKey || Deno.env.get('FREELLMAPI_GENERATION_ENABLED') === 'true') && attempts < 3) {
    const used = new Set(accepted.map((item) => item.generation_angle));
    const angle = [...angles, ...allAngles].find((candidate) => !used.has(candidate)) ?? allAngles[attempts % allAngles.length];
    attempts += 1;
    try {
      const regenerated = await generateWithGemini({ ...body, count: Math.max(3, target - accepted.length) }, apiKey, { angles: [angle], previousResponses: [...previous, ...accepted] });
      regenerated.forEach((candidate) => { if (accepted.length < target) accept(candidate, angle); });
    } catch (error) {
      console.error('Uniqueness regeneration failed:', error instanceof Error ? error.message : error);
      break;
    }
  }
  // Keep only model-written options; generic template padding would undermine the selected tone and stance.
  return accepted.slice(0, target);
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  const requestId = crypto.randomUUID();
  try {
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Only POST requests are supported.' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (contentLength > 8_000_000) {
      return new Response(JSON.stringify({ error: 'Request is too large. Please reduce the attachment size.' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const body = await request.json() as RequestBody;
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
        !['generate', 'suggest', 'refine', 'summarize'].includes(body.action)) {
      return new Response(JSON.stringify({ error: 'Invalid request action or body.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const textFields: Array<keyof RequestBody> = ['post', 'content_url', 'comment', 'instruction', 'file_name'];
    for (const field of textFields) {
      const value = body[field];
      if (value !== undefined && (typeof value !== 'string' || value.length > (field === 'post' ? 60000 : 10000))) {
        return new Response(JSON.stringify({ error: 'One or more text fields are invalid or too long.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    for (const field of ['image_base64', 'file_base64'] as const) {
      if (body[field] !== undefined && (typeof body[field] !== 'string' || body[field]!.length > 7_000_000)) {
        return new Response(JSON.stringify({ error: 'Attachment is too large.' }), { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }
    if (body.count !== undefined && (!Number.isInteger(body.count) || body.count < 1 || body.count > MAX_COMMENT_COUNT)) {
      return new Response(JSON.stringify({ error: 'Comment count must be between 1 and 5.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    const freeLLMAPIConfig = await getFreeLLMAPIConfig(body);
    if (!apiKey && !freeLLMAPIConfig) return new Response(JSON.stringify({ error: 'AI service is not configured.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    if (body.action === 'refine') {
    const comment = clean(body.comment ?? '');
    if (!comment) return new Response(JSON.stringify({ error: 'A comment is required.' }), { status: 400, headers: corsHeaders });
    const instruction = clean(body.instruction ?? 'Make this more natural and concise');
    let lastCandidate = '';
    let lastUpstreamError: Error | null = null;

    for (let rewriteAttempt = 1; rewriteAttempt <= 3; rewriteAttempt++) {
      const variationRule = rewriteAttempt === 1
        ? 'Make a meaningful rewrite, not a synonym swap.'
        : 'The previous rewrite was too similar to the original. Change the sentence structure, opening, and phrasing substantially while preserving the meaning. Do not return the original text.';

      const prompt = buildRefinePrompt({ body, comment, instruction, variationRule, lastCandidate });

      for (let apiAttempt = 1; apiAttempt <= 3; apiAttempt++) {
        try {
          if (await getFreeLLMAPIConfig(body)) {
            try {
              const parsed = parseJson(await callFreeLLMAPI(prompt, body, true));
              const refined = normalizeComments([parsed])[0];
              lastCandidate = clean(refined?.comment_text ?? '');
              if (lastCandidate && !isRefineNearDuplicate(lastCandidate, comment)) {
                return new Response(JSON.stringify(refined), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
              }
              break;
            } catch (error) {
              lastUpstreamError = error instanceof Error ? error : new Error(String(error));
              console.error('FreeLLMAPI refine failed; trying Gemini fallback:', lastUpstreamError.message);
              if (!apiKey) throw error;
            }
          }

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              contents:[{parts:[{text:prompt}]}],
              generationConfig:{responseMimeType:'application/json'}
            })
          });
          const data = await response.json();

          if (!response.ok) {
            const message = data?.error?.message ?? `Gemini request failed (${response.status})`;
            lastUpstreamError = new Error(message);
            if (((response.status === 500 || response.status === 503) || (response.status === 429 && !/quota|resource.?exhausted|generate_content_free_tier_requests/i.test(lastUpstreamError?.message || ""))) && apiAttempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, apiAttempt * 1200));
              continue;
            }
            throw lastUpstreamError;
          }

          const parsed = parseJson(data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
          const refined = normalizeComments([parsed])[0];
          lastCandidate = clean(refined?.comment_text ?? '');

          if (lastCandidate && !isRefineNearDuplicate(lastCandidate, comment)) {
            return new Response(JSON.stringify(refined), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }

          break;
        } catch (error) {
          lastUpstreamError = error instanceof Error ? error : new Error(String(error));
          if (apiAttempt < 3 && (/500|503|high demand|temporarily|overload/i.test(lastUpstreamError.message) || (/429/.test(lastUpstreamError.message) && !/quota|resource.?exhausted|generate_content_free_tier_requests/i.test(lastUpstreamError.message)))) {
            await new Promise((resolve) => setTimeout(resolve, apiAttempt * 1200));
            continue;
          }
          break;
        }
      }
    }

    if (lastUpstreamError && /quota|resource.?exhausted|generate_content_free_tier_requests/i.test(lastUpstreamError.message)) {
      return new Response(JSON.stringify({
        error: 'AI limit reached',
        message: "We've reached the current AI usage limit. Please try again later."
      }), { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (lastUpstreamError && /429|500|503|high demand|temporarily|overload/i.test(lastUpstreamError.message)) {
      return new Response(JSON.stringify({
        error: 'Gemini is temporarily busy. Please try Refine again in a moment.'
      }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      error: 'Refine could not produce a sufficiently different rewrite. Try a more specific instruction.'
    }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  if (body.action === 'summarize') {
      const summary = await summarizeWithGemini(body, apiKey);
      return new Response(JSON.stringify({ summary }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } });
    }

    if (body.action === 'suggest') {
      const suggestions = await suggestWithGemini(body, apiKey);
      return new Response(JSON.stringify(suggestions), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } });
    }

    const sourceKey = `${body.post ?? ''}\n${body.content_url ?? ''}\n${body.file_name ?? ''}\n${body.image_mime_type ?? ''}:${body.image_base64 ? await sha256(body.image_base64) : ''}\n${body.file_mime_type ?? ''}:${body.file_base64 ? await sha256(body.file_base64) : ''}`;
    const fingerprint = await sha256(normalize(sourceKey));
    const previous = await loadPreviousResponses(fingerprint);
    const count = Math.min(Math.max(body.count ?? 5, 3), MAX_COMMENT_COUNT);
    const angles = selectAngles(body, previous, count);
    const initial = await generateWithGemini(body, apiKey, { angles, previousResponses: previous });
    const comments = await enforceUniqueness(initial, body, apiKey, previous, angles);
    return new Response(JSON.stringify({ comments, content_fingerprint: fingerprint }), { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-ID': requestId } });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error("CommentCraft request failed", {
      requestId,
      error: errorMessage,
    });

    if (/quota|resource.?exhausted|generate_content_free_tier_requests/i.test(errorMessage)) {
      return new Response(JSON.stringify({
        error: "AI limit reached",
        message: "We've reached the current AI usage limit. Please try again later.",
        request_id: requestId,
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (/high demand|temporarily unavailable|overloaded|service unavailable|503/i.test(errorMessage)) {
      return new Response(JSON.stringify({
        error: "AI temporarily busy",
        message: "The AI service is busy right now. Please try again in a moment.",
        request_id: requestId,
      }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      error: "We could not complete that request. Please try again.",
      request_id: requestId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
