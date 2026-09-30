import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingAccess } from "@/lib/billing/access";
import { generateEditorialPost } from "@/lib/ai/editorial";
import { analyzeIdea } from "@/lib/idea-radar/ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function access() {
  const billing = await getBillingAccess();
  if (!billing.authenticated) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  if (!billing.allowed) return NextResponse.json({ error: "Start your free trial or subscribe to continue." }, { status: 402 });
  return null;
}

export async function GET(request: Request) {
  const denied = await access();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const category = params.get("category");
  const status = params.get("status");
  const savedOnly = params.get("saved") === "true";
  const admin = createAdminClient();

  let query = admin.from("idea_radar_ideas")
    .select("id,title,description,why_interesting,insight,category,source_name,source_url,published_at,status,created_at,idea_radar_angles(id,angle,why,evidence)")
    .order("created_at", { ascending: false })
    .limit(60);

  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);

  const { data: ideas, error } = await query;
  if (error) {
    console.error("Idea Radar GET failed:", error);
    return NextResponse.json({ error: "Unable to load ideas. Apply the Idea Radar database migration first." }, { status: 500 });
  }

  const { data: actions } = await admin
    .from("idea_radar_user_actions")
    .select("idea_id,action")
    .eq("user_id", user.id);

  const actionMap: Record<string, string[]> = {};
  for (const action of actions ?? []) {
    actionMap[action.idea_id] ??= [];
    actionMap[action.idea_id].push(action.action);
  }

  const filtered = (ideas ?? [])
    .filter((idea) => !actionMap[idea.id]?.includes("hidden"))
    .filter((idea) => !savedOnly || actionMap[idea.id]?.includes("saved"));

  return NextResponse.json({
    ideas: filtered.map((idea) => ({
      ...idea,
      actions: actionMap[idea.id] ?? [],
    })),
  });
}

export async function POST(request: Request) {
  const denied = await access();
  if (denied) return denied;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json();
  const action = typeof body?.action === "string" ? body.action : "";
  const admin = createAdminClient();

  if (["save", "hide", "used", "reviewed"].includes(action)) {
    const ideaId = typeof body?.ideaId === "string" ? body.ideaId : "";
    if (!ideaId) return NextResponse.json({ error: "ideaId is required" }, { status: 400 });
    const mapped = action === "save" ? "saved" : action;
    const { error } = await admin.from("idea_radar_user_actions").upsert(
      { user_id: user.id, idea_id: ideaId, action: mapped, updated_at: new Date().toISOString() },
      { onConflict: "user_id,idea_id,action" },
    );
    if (error) return NextResponse.json({ error: "Unable to update idea status." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "angles") {
    const ideaId = typeof body?.ideaId === "string" ? body.ideaId : "";
    if (!ideaId) return NextResponse.json({ error: "ideaId is required" }, { status: 400 });
    const { data: idea } = await admin.from("idea_radar_ideas").select("*").eq("id", ideaId).single();
    if (!idea) return NextResponse.json({ error: "Idea not found." }, { status: 404 });

    const analysis = await analyzeIdea({
      title: idea.title,
      summary: idea.description + "\n" + idea.insight,
      source: idea.source_name,
      url: idea.source_url,
      category: idea.category,
    });
    const angles = analysis.angles;
    if (angles.length) await admin.from("idea_radar_angles").upsert(
      angles.map((a) => ({ idea_id: ideaId, angle: a.angle, why: a.why, evidence: a.evidence })),
      { onConflict: "idea_id,angle" },
    );
    return NextResponse.json({ angles });
  }

  if (action === "generate-post") {
    const ideaId = typeof body?.ideaId === "string" ? body.ideaId : "";
    const angleId = typeof body?.angleId === "string" ? body.angleId : "";
    if (!ideaId || !angleId) return NextResponse.json({ error: "ideaId and angleId are required" }, { status: 400 });

    const [{ data: idea }, { data: angle }] = await Promise.all([
      admin.from("idea_radar_ideas").select("*").eq("id", ideaId).single(),
      admin.from("idea_radar_angles").select("*").eq("id", angleId).single(),
    ]);
    if (!idea || !angle || angle.idea_id !== idea.id) return NextResponse.json({ error: "Idea or angle not found." }, { status: 404 });

    const post = await generateEditorialPost(
      { topic: idea.category, headline: idea.title, source: idea.source_name, summary: idea.description + "\n" + idea.insight, url: idea.source_url },
      angle.angle,
      angle.why,
      "Write the strongest natural version of the selected thesis. Use the selected idea as inspiration and keep the wording original.",
      [{ claim: idea.title, support: idea.description, type: "fact" }, { claim: idea.insight, support: idea.why_interesting, type: "interpretation" }],
    );

    await admin.from("idea_radar_ideas").update({ status: "post_generated", updated_at: new Date().toISOString() }).eq("id", idea.id);
    return NextResponse.json({ post });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}