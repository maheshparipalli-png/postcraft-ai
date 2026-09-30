import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingAccess } from "@/lib/billing/access";
import { fetchFeed, normalizeTitle } from "@/lib/idea-radar/feed";
import { analyzeIdea } from "@/lib/idea-radar/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  const billing = await getBillingAccess();
  if (!billing.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!billing.allowed) return NextResponse.json({ error: "Start your free trial or subscribe to continue." }, { status: 402 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const admin = createAdminClient();
  const { data: sources, error: sourceError } = await admin
    .from("idea_radar_sources")
    .select("id,name,url,category,type")
    .eq("enabled", true);

  if (sourceError) return NextResponse.json({ error: "Unable to load Idea Radar sources. Apply the database migration first." }, { status: 500 });

  const results = await Promise.allSettled((sources ?? []).map(async (source) => {
    const items = await fetchFeed(source.url);
    let added = 0;
    for (const item of items.slice(0, 15)) {
      const canonicalUrl = item.link.split("#")[0].trim();
      const normalizedTitle = normalizeTitle(item.title);
      const contentHash = normalizeTitle(item.title + " " + item.summary).slice(0, 500);
      const { data: existing } = await admin
        .from("idea_radar_feed_items")
        .select("id")
        .or("canonical_url.eq." + canonicalUrl + ",normalized_title.eq." + normalizedTitle)
        .limit(1);

      if (existing?.length) continue;

      const { data: inserted } = await admin.from("idea_radar_feed_items").insert({
        source_id: source.id,
        canonical_url: canonicalUrl,
        normalized_title: normalizedTitle,
        title: item.title,
        description: item.summary,
        source_name: source.name,
        source_url: canonicalUrl,
        published_at: item.publishedAt,
        category: source.category,
        content_hash: contentHash,
      }).select("id").single();

      if (inserted) added += 1;
    }
    return { source: source.name, added, ok: true };
  }));

  const { data: candidates } = await admin
    .from("idea_radar_feed_items")
    .select("id,title,description,source_name,source_url,published_at,category")
    .order("published_at", { ascending: false })
    .limit(16);

  let analyzed = 0;
  let analysisAttempted = 0;
  let rejected = 0;
  const analysisErrors: { title: string; error: string }[] = [];

  for (const item of candidates ?? []) {
    const { data: already } = await admin.from("idea_radar_ideas").select("id").eq("feed_item_id", item.id).limit(1);
    if (already?.length) continue;

    analysisAttempted += 1;
    try {
      const result = await analyzeIdea({
        title: item.title,
        summary: item.description ?? "",
        source: item.source_name,
        url: item.source_url,
        category: item.category,
      });

      if (!result.keep) {
        rejected += 1;
        continue;
      }

      const { data: idea, error: ideaError } = await admin.from("idea_radar_ideas").insert({
        feed_item_id: item.id,
        title: result.title || item.title,
        description: result.description || item.description || "",
        why_interesting: result.whyInteresting,
        insight: result.insight,
        category: result.category || item.category,
        source_name: item.source_name,
        source_url: item.source_url,
        published_at: item.published_at,
        analysis: { generated_by: "idea-radar", keep: true },
      }).select("id").single();

      if (ideaError) {
        analysisErrors.push({ title: item.title, error: ideaError.message });
        continue;
      }

      if (idea && result.angles.length) {
        const { error: angleError } = await admin.from("idea_radar_angles").insert(result.angles.map((a) => ({
          idea_id: idea.id, angle: a.angle, why: a.why, evidence: a.evidence,
        })));
        if (angleError) {
          analysisErrors.push({ title: item.title, error: angleError.message });
        }
      }

      if (idea) analyzed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Idea Radar analysis failed:", item.title, error);
      analysisErrors.push({ title: item.title, error: message });
    }
  }

  const sourceResults = results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { ok: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) }
  );
  const sourceFailures = sourceResults.filter((result) => !result.ok).length;
  const sourceSuccesses = sourceResults.length - sourceFailures;

  return NextResponse.json({
    ok: true,
    sources: (sources ?? []).length,
    sourceSuccesses,
    sourceFailures,
    sourceResults,
    candidates: (candidates ?? []).length,
    analysisAttempted,
    analyzed,
    rejected,
    analysisErrors,
    refreshedBy: user.id,
  });
}
