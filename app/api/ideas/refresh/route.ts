import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingAccess } from "@/lib/billing/access";
import { fetchFeed, normalizeTitle } from "@/lib/idea-radar/feed";
import { EVERGREEN_IDEAS } from "@/lib/idea-radar/evergreen";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function fallbackAngles(title: string, description: string) {
  return [
    {
      angle: `What people usually miss about: ${title}`,
      why: "Look past the obvious interpretation and identify the less visible idea underneath the story.",
      evidence: description || title,
    },
    {
      angle: `The practical lesson from: ${title}`,
      why: "Turn the story into a specific lesson a professional can apply.",
      evidence: description || title,
    },
    {
      angle: `Why this matters more than it seems: ${title}`,
      why: "Explore the second-order effect or consequence that is easy to overlook.",
      evidence: description || title,
    },
    {
      angle: `A different way to think about: ${title}`,
      why: "Reframe the story so the reader sees it from a less obvious perspective.",
      evidence: description || title,
    },
    {
      angle: `The question behind: ${title}`,
      why: "Turn the story into a useful question that challenges the reader's current assumptions.",
      evidence: description || title,
    },
  ];
}

async function addAngles(admin: ReturnType<typeof createAdminClient>, ideaId: string, angles: ReturnType<typeof fallbackAngles>) {
  if (!angles.length) return;
  await admin.from("idea_radar_angles").upsert(
    angles.map((angle) => ({
      idea_id: ideaId,
      angle: angle.angle,
      why: angle.why,
      evidence: angle.evidence,
    })),
    { onConflict: "idea_id,angle" },
  );
}

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

  let currentIdeasCreated = 0;
  const ideaErrors: { title: string; error: string }[] = [];

  for (const item of candidates ?? []) {
    const { data: already } = await admin
      .from("idea_radar_ideas")
      .select("id")
      .eq("feed_item_id", item.id)
      .limit(1);

    if (already?.length) continue;

    const { data: idea, error: ideaError } = await admin.from("idea_radar_ideas").insert({
      feed_item_id: item.id,
      title: item.title,
      description: item.description || "",
      why_interesting: item.description
        ? "This story is interesting because its source material points to a real question, comparison, behavior, or change that professionals can examine beyond the headline."
        : "This story is worth exploring for the broader professional lesson behind the headline.",
      insight: item.description
        ? "Look for the underlying question, tension, behavior, or business lesson in the source rather than simply repeating the article."
        : "Look beyond the headline for the broader lesson the story can reveal.",
      category: item.category,
      source_name: item.source_name,
      source_url: item.source_url,
      published_at: item.published_at,
      analysis: { generated_by: "idea-radar", keep: true, ai_analysis_disabled: true, content_type: "current" },
    }).select("id").single();

    if (ideaError) {
      ideaErrors.push({ title: item.title, error: ideaError.message });
      continue;
    }

    if (idea) {
      await addAngles(admin, idea.id, fallbackAngles(item.title, item.description || ""));
      currentIdeasCreated += 1;
    }
  }

  const { data: existingEvergreen } = await admin
    .from("idea_radar_ideas")
    .select("analysis")
    .is("feed_item_id", null);

  const existingKeys = new Set(
    (existingEvergreen ?? [])
      .map((row) => (row.analysis as { evergreen_key?: string } | null)?.evergreen_key)
      .filter(Boolean),
  );

  let evergreenCreated = 0;
  for (const evergreen of EVERGREEN_IDEAS) {
    if (existingKeys.has(evergreen.key)) continue;

    const { data: idea, error: ideaError } = await admin.from("idea_radar_ideas").insert({
      feed_item_id: null,
      title: evergreen.title,
      description: evergreen.description,
      why_interesting: evergreen.whyInteresting,
      insight: evergreen.insight,
      category: evergreen.category,
      source_name: "PostCraft Evergreen Library",
      source_url: "",
      published_at: null,
      analysis: {
        generated_by: "idea-radar",
        keep: true,
        ai_analysis_disabled: true,
        content_type: "evergreen",
        evergreen_key: evergreen.key,
      },
    }).select("id").single();

    if (ideaError) {
      ideaErrors.push({ title: evergreen.title, error: ideaError.message });
      continue;
    }

    if (idea) {
      await addAngles(admin, idea.id, evergreen.angles);
      evergreenCreated += 1;
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
    currentStoriesChecked: (candidates ?? []).length,
    currentIdeasCreated,
    evergreenIdeasCreated: evergreenCreated,
    ideasCreated: currentIdeasCreated + evergreenCreated,
    aiAnalysisDisabled: true,
    ideaErrors,
    refreshedBy: user.id,
  });
}
