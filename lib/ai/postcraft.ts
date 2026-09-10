import { getAIProvider } from "@/lib/ai/provider";

type IdeaInput = {
  topic: string;
  headline: string;
  source: string;
  summary: string;
  whyItMatters?: string;
  angle?: string;
  angleWhy?: string;
};

const provider = () => getAIProvider();

async function ask(prompt: string) {
  return provider().generateText(prompt);
}

function parseJsonArray(text: string): unknown[] {
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

export async function generatePostCraftAngles(input: IdeaInput) {
  const prompt = `You are the editorial brain inside PostCraft AI.

The product promise is NOT "write a LinkedIn post about this news." It is "help me find something worth saying."

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Source: ${input.source}
Summary: ${input.summary || "No reliable summary was supplied."}

Generate SIX candidate theses. A thesis is a specific belief or observation that a smart professional could reasonably argue about after reading this story.

A strong thesis should:
- make a non-obvious claim about the story;
- contain tension, a trade-off, contradiction, or consequence;
- be narrow enough that the eventual post has one clear argument;
- be grounded only in the supplied story;
- give the reader a reason to reconsider the obvious interpretation.

Do NOT produce topics, summaries, generic concerns, or policy slogans.
Avoid formulations such as "AI has benefits and risks", "there is a need for guidelines", "this raises questions", "technology is changing...", or "we must strike a balance".
Do not import facts from outside the story.

Return ONLY valid JSON:
[{"angle":"thesis","why":"why this is interesting and arguable"},{"angle":"thesis","why":"why this is interesting and arguable"},{"angle":"thesis","why":"why this is interesting and arguable"},{"angle":"thesis","why":"why this is interesting and arguable"},{"angle":"thesis","why":"why this is interesting and arguable"},{"angle":"thesis","why":"why this is interesting and arguable"}]`;

  const raw = await ask(prompt);
  const candidates = parseJsonArray(raw)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const value = item as { angle?: unknown; why?: unknown };
      const angle = typeof value.angle === "string" ? value.angle.trim() : "";
      const why = typeof value.why === "string" ? value.why.trim() : "";
      return angle ? { angle, why } : null;
    })
    .filter((item): item is { angle: string; why: string } => Boolean(item));

  const unique = Array.from(new Map(candidates.map((item) => [item.angle.toLowerCase(), item])).values());
  return unique.slice(0, 3);
}

export async function generatePostCraftPost(input: IdeaInput, modeInstruction: string) {
  const thesisPrompt = `You are the thesis editor for PostCraft AI.

Story headline: ${input.headline}
Story summary: ${input.summary || "No reliable summary was supplied."}
Selected angle: ${input.angle || "No angle supplied."}
Why the angle was selected: ${input.angleWhy || "Not supplied."}

Write ONE sentence stating the strongest specific thesis this angle can support.
It must be an argument, not a topic. It should be something a thoughtful reader could disagree with.
Use only the supplied information. Do not invent facts.
Return only the thesis sentence.`;

  const thesis = (await ask(thesisPrompt)).replace(/^\s*["']|["']\s*$/g, "").trim();

  const draftPrompt = `You are a strong human LinkedIn writer, not a corporate copywriter.

Write a post around this thesis:
"${thesis}"

STORY
Topic: ${input.topic}
Headline: ${input.headline}
Summary: ${input.summary || "No reliable summary was supplied."}
Why worth exploring: ${input.whyItMatters || "Not supplied."}
Selected angle: ${input.angle || "Not supplied."}

GROUNDING
- Use only the supplied story and thesis.
- Treat claims in a sensational or uncertain headline as claims, not facts.
- Do not invent statistics, examples, people, companies, quotes, events, outcomes, or personal experiences.
- Interpretation is allowed; invented evidence is not.

WRITING
- 120-180 words.
- 4-7 short paragraphs.
- One argument. No list of generic observations.
- Open with the actual tension or insight, not the headline.
- Make the reasoning move forward: observation -> why it matters -> implication.
- Use plain language and varied sentence rhythm.
- One sentence can carry the punch. Another can explain it.
- Stop when the thought is complete.
- No heading, title, labels, emojis, or more than two hashtags.
- Never end with "What do you think?", "Agree?", or "Thoughts?".

DO NOT USE THESE PATTERNS:
"It's crucial to strike a balance"
"This highlights the need"
"This phenomenon"
"In today's rapidly changing world"
"game changer"
"unlock potential"
"drive real business value"
"significant implications"
"raises a crucial question"
"as we navigate"
"in this evolving landscape"
"the key takeaway"
"it is important to remember"
"we must embrace"
"we need to consider"

${modeInstruction}

Return only the finished post.`;

  let post = (await ask(draftPrompt)).trim();

  const qualityPrompt = `You are the final editor for a human-written LinkedIn post.

THESIS:
${thesis}

DRAFT:
${post}

Check four things:
1. Does it make one clear, debatable point?
2. Does the opening have a real insight rather than a generic setup?
3. Does any sentence sound like generic AI/LinkedIn copy?
4. Does it introduce unsupported facts or fake personal experience?

If the draft fails any test, rewrite it. Preserve the thesis but improve the argument, specificity, and naturalness.
If it already passes, return it unchanged.

Keep it 120-180 words, 4-7 short paragraphs, plain language, no heading, no "What do you think?", no corporate filler, and no invented evidence.
Return ONLY the final post.`;

  post = (await ask(qualityPrompt)).trim();
  return post;
}
