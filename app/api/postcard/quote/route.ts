import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingAccess } from "@/lib/billing/access";

export const dynamic = "force-dynamic";

const FIELDS: Record<string, string[]> = {
  resilience: ["failure", "fail", "overcome", "courage", "try", "change", "challenge", "strength", "difficult"],
  leadership: ["lead", "leadership", "people", "team", "service", "responsibility", "example"],
  entrepreneurship: ["business", "work", "success", "risk", "opportunity", "create", "build", "enterprise"],
  discipline: ["discipline", "habit", "work", "effort", "practice", "consistency", "persistence"],
  creativity: ["create", "imagination", "creative", "idea", "art", "dream", "curiosity"],
  learning: ["learn", "knowledge", "education", "mistake", "experience", "question", "wisdom"],
  courage: ["courage", "fear", "brave", "risk", "bold", "doubt"],
  success: ["success", "achievement", "goal", "victory", "excellence", "great", "win"],
  life: ["life", "time", "live", "happiness", "love", "change", "journey"],
  sports: ["game", "win", "victory", "champion", "practice", "competition", "team"],
};

const DEFAULT_FIELDS = Object.keys(FIELDS);

function hashQuote(text: string, author: string) {
  return createHash("sha256")
    .update(`${text.toLowerCase().replace(/\s+/g, " ").trim()}|${author.toLowerCase().trim()}`)
    .digest("hex");
}

function scoreQuote(text: string, field: string) {
  const words = FIELDS[field] ?? [];
  const haystack = text.toLowerCase();
  return words.reduce((score, word) => score + (haystack.includes(word) ? 1 : 0), 0);
}

async function fetchZenQuotes() {
  const key = process.env.ZENQUOTES_API_KEY?.trim();
  const url = key ? `https://zenquotes.io/api/quotes/${encodeURIComponent(key)}` : "https://zenquotes.io/api/quotes";
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": "PostCraft AI/1.0" },
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) throw new Error(`Quote feed returned HTTP ${response.status}.`);
  const payload = await response.json();
  if (!Array.isArray(payload)) throw new Error("Quote feed returned an invalid response.");

  return payload
    .filter((item): item is { q: string; a?: string } => typeof item?.q === "string" && item.q.trim().length >= 30)
    .map((item) => ({
      quoteText: item.q.trim(),
      author: typeof item.a === "string" ? item.a.trim() : "Unknown",
      source: "ZenQuotes",
    }));
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const billing = await getBillingAccess();
    if (!billing.allowed) return NextResponse.json({ error: "Start your free trial or subscribe to continue." }, { status: 402 });

    const params = new URL(request.url).searchParams;
    const requestedField = params.get("field") || "resilience";
    const field = FIELDS[requestedField] ? requestedField : DEFAULT_FIELDS[0];

    const admin = createAdminClient();

    let { data: pool } = await admin
      .from("postcard_quote_pool")
      .select("quote_hash,quote_text,author,category,source")
      .order("fetched_at", { ascending: false })
      .limit(200);

    if (!pool?.length || pool.length < 30) {
      const fetched = await fetchZenQuotes();
      const rows = fetched.map((quote) => {
        const scores = DEFAULT_FIELDS.map((name) => ({ name, score: scoreQuote(quote.quoteText, name) }))
          .sort((a, b) => b.score - a.score);
        const category = scores[0]?.score ? scores[0].name : field;
        return {
          quote_hash: hashQuote(quote.quoteText, quote.author),
          quote_text: quote.quoteText,
          author: quote.author,
          category,
          source: quote.source,
        };
      });

      const { error: upsertError } = await admin
        .from("postcard_quote_pool")
        .upsert(rows, { onConflict: "quote_hash", ignoreDuplicates: true });

      if (upsertError) console.error("Quote pool refresh failed:", upsertError);

      const result = await admin
        .from("postcard_quote_pool")
        .select("quote_hash,quote_text,author,category,source")
        .order("fetched_at", { ascending: false })
        .limit(200);
      pool = result.data ?? [];
    }

    const hashes = (pool ?? []).map((quote) => quote.quote_hash);
    const usageResult = hashes.length
      ? await admin
          .from("postcard_quote_usage")
          .select("quote_hash,cooldown_until")
          .eq("user_id", user.id)
          .in("quote_hash", hashes)
      : { data: [] as { quote_hash: string; cooldown_until: string }[] };

    const now = Date.now();
    const blocked = new Set(
      (usageResult.data ?? [])
        .filter((item) => new Date(item.cooldown_until).getTime() > now)
        .map((item) => item.quote_hash),
    );

    const candidates = (pool ?? [])
      .filter((quote) => !blocked.has(quote.quote_hash))
      .map((quote) => ({ quote, score: scoreQuote(quote.quote_text, field) }))
      .sort((a, b) => b.score - a.score);

    const topCandidates = candidates.slice(0, Math.min(20, candidates.length));
    const selected = topCandidates[Math.floor(Math.random() * topCandidates.length)];
    const quote = selected?.quote;

    if (!quote) {
      return NextResponse.json(
        { error: "No fresh quotes are available right now. Try another field." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      quote: {
        text: quote.quote_text,
        author: quote.author,
        hash: quote.quote_hash,
        category: quote.category,
        source: quote.source,
      },
      attribution: "Inspirational quotes provided by ZenQuotes API",
    });
  } catch (error) {
    console.error("PostCard quote feed failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not retrieve a motivational quote." },
      { status: 502 },
    );
  }
}
