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
  const { data: existingEvergreen, error: existingError } = await admin
    .from("idea_radar_ideas")
    .select("analysis")
    .is("feed_item_id", null);

  if (existingError) {
    return NextResponse.json({ error: "Unable to load existing evergreen ideas." }, { status: 500 });
  }

  const existingKeys = new Set(
    (existingEvergreen ?? [])
      .map((row) => (row.analysis as { evergreen_key?: string; content_type?: string } | null))
      .filter((analysis) => analysis?.content_type === "evergreen")
      .map((analysis) => analysis?.evergreen_key)
      .filter((key): key is string => Boolean(key)),
  );

  let evergreenCreated = 0;
  const ideaErrors: { title: string; error: string }[] = [];

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

  return NextResponse.json({
    ok: true,
    mode: "evergreen-only",
    evergreenIdeasCreated: evergreenCreated,
    currentIdeasCreated: 0,
    ideasCreated: evergreenCreated,
    ideaErrors,
    refreshedBy: user.id,
  });
}
