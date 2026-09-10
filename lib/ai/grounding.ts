import { getAIProvider } from "@/lib/ai/provider";

type Story = { headline: string; summary: string };
type Angle = { angle: string; why: string };

const provider = () => getAIProvider();

function parse(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const value = JSON.parse(match[0]);
      return value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
}

export async function auditPostCraftAngles(story: Story, angles: Angle[]) {
  if (!angles.length) return [];

  const prompt = `You are PostCraft AI's final evidence auditor.

Your job is NOT to improve or rewrite the candidates. Your job is to reject any candidate that contains an important idea not supported by the supplied story.

STORY EVIDENCE
Headline: ${story.headline}
Summary: ${story.summary}

CANDIDATES
${angles.map((item, index) => `${index}. THESIS: ${item.angle}\nWHY: ${item.why}`).join("\n\n")}

For every candidate, check each factual or causal component of the thesis separately.
Reject a candidate if it introduces a new outcome, group, mechanism, statistic, comparison, causal relationship, or condition that the evidence does not support.
Do not reject a thesis merely because it is an interpretation. Reject it when the interpretation requires an unsupported factual premise.
Preserve uncertainty: a scenario, warning, or possibility must not become a certainty.
A thesis such as "AI could make the economy richer without making knowledge workers proportionally better off" is acceptable when the supplied evidence says GDP rises while knowledge-worker wages or employment worsen in relevant scenarios.
A thesis such as "AI will exacerbate skills gaps and make professions obsolete" is not acceptable unless the supplied evidence explicitly says that.

Return ONLY JSON:
{"approved":[true,false]}`;

  try {
    const parsed = parse(
      await provider().generateText(prompt, {
        format: "json",
        temperature: 0.05,
        numPredict: 180,
      })
    );
    const approved = parsed?.approved;
    if (!Array.isArray(approved)) return angles;
    return angles.filter((_, index) => approved[index] === true);
  } catch (error) {
    console.warn(
      "[PostCraft] angle_audit_failed",
      error instanceof Error ? error.message : "unknown error"
    );
    return angles;
  }
}
