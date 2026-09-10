"use client";

import { useRef, useState } from "react";

type Idea = {
  title: string;
  description: string;
  whyItMatters: string;
  sourceIndexes: number[];
  source: string;
  url: string;
  publishedAt: string;
};

type AngleSuggestion = {
  text: string;
  why: string;
};

type PostMode = "default" | "regenerate" | "sharper" | "human";

const topics = [
  "Technology",
  "Business",
  "Leadership",
  "Politics",
  "Geopolitics",
  "Economy",
  "Science",
  "Society",
  "Custom topic",
];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function Home() {
  const [topic, setTopic] = useState("Technology");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [selectedIdea, setSelectedIdea] = useState<Idea | null>(null);
  const [angle, setAngle] = useState("");
  const [suggestedAngles, setSuggestedAngles] = useState<AngleSuggestion[]>([]);
  const [copied, setCopied] = useState(false);
  const [angleLoading, setAngleLoading] = useState(false);
  const [post, setPost] = useState("");
  const [loading, setLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [error, setError] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const angleRequestRef = useRef(0);

  async function discoverIdeas() {
    setLoading(true);
    setError("");
    setIdeas([]);
    setSelectedIdea(null);
    setSuggestedAngles([]);
    setAngle("");
    setPost("");

    try {
      const response = await fetch("/api/discover", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic: topic === "Custom topic" ? customTopic.trim() : topic,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Discovery failed");
      }

      setIdeas(Array.isArray(data?.ideas) ? data.ideas : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Discovery failed");
    } finally {
      setLoading(false);
    }
  }

  async function generateAngles(idea: Idea) {
    const requestId = ++angleRequestRef.current;
    setAngleLoading(true);
    setAngle("");
    setError("");
    setSuggestedAngles([]);

    try {
      const prompt = `You are PostCraft AI, an editorial thinking partner.

Analyze this news story for someone who wants to write a thoughtful LinkedIn post.

Topic: ${topic === "Custom topic" ? customTopic.trim() : topic}
Headline: ${idea.title}
Source: ${idea.source}
Summary: ${idea.description || "No reliable summary was supplied; do not invent missing facts."}

Find SIX genuinely different ways a professional could say something interesting about this story. We will keep only the strongest grounded angles.

GROUNDING IS NON-NEGOTIABLE:
- Use ONLY the supplied story. Do not import facts, examples, companies, industries, or arguments from another story.
- The subject of every angle must clearly belong to this specific headline and summary.
- If the story is about schools, stay about schools/education/AI awareness/technology dependence; do not turn it into a generic business turnaround story.
- Do not infer business, economic, medical, political, or other consequences unless the supplied story actually supports them.

Each angle must:
- make a specific claim, tension, trade-off, implication, or question
- go beyond summarizing the news
- be clearly grounded in this story
- give the writer something they can actually argue
- be meaningfully different from the other two
- avoid claims that require facts not supplied here

Think across different lenses where appropriate: business consequences, leadership decisions, incentives, strategy, society, risk, or an overlooked implication. Do not force lenses that do not fit.

Avoid generic angles such as "AI is changing the world" or "technology is important."

Return ONLY valid JSON in this exact shape:
[{"angle":"short specific point of view","why":"one sentence explaining why this angle gives the writer something interesting to explore"},{"angle":"...","why":"..."},{"angle":"...","why":"..."},{"angle":"...","why":"..."},{"angle":"...","why":"..."},{"angle":"...","why":"..."}]`;

      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Angle generation failed");
      }

      let parsed: unknown;

      try {
        parsed = JSON.parse(data.text);
      } catch {
        const match = data.text.match(/\[[\s\S]*\]/);
        if (!match) throw new Error("AI returned an invalid angle list");
        parsed = JSON.parse(match[0]);
      }

      const generatedAngles: AngleSuggestion[] = Array.isArray(parsed)
        ? parsed
            .map((item): AngleSuggestion | null => {
              if (typeof item === "string") {
                return {
                  text: item.trim(),
                  why: "This gives the story a specific point of view instead of turning it into a news summary.",
                };
              }

              if (item && typeof item === "object") {
                const value = item as { angle?: unknown; why?: unknown };
                const text = typeof value.angle === "string" ? value.angle.trim() : "";
                const why = typeof value.why === "string" ? value.why.trim() : "";
                if (text) return { text, why };
              }

              return null;
            })
            .filter((item): item is AngleSuggestion => Boolean(item?.text))
        : [];

      const storyText = `${idea.title} ${idea.description}`.toLowerCase();
      const offTopicTerms = [
        "turnaround", "productivity", "business recovery", "revenue", "profit",
        "margin", "shareholder", "earnings", "corporate strategy", "economic impact",
        "stock price", "marketing campaign", "customer acquisition", "workforce reduction",
      ];

      const groundedAngles = generatedAngles.filter((item) => {
        const text = item.text.toLowerCase();
        return !offTopicTerms.some((term) => text.includes(term) && !storyText.includes(term));
      });

      const uniqueAngles = Array.from(
        new Map(groundedAngles.map((item) => [item.text.toLowerCase(), item])).values()
      ).slice(0, 3);

      if (uniqueAngles.length !== 3) {
        throw new Error("AI returned fewer than three grounded angles for this story");
      }

      if (requestId !== angleRequestRef.current) return;

      setSuggestedAngles(uniqueAngles);
      setAngle(uniqueAngles[0].text);
    } catch (error) {
      if (requestId === angleRequestRef.current) {
        setError(
          error instanceof Error ? error.message : "Angle generation failed"
        );
      }
    } finally {
      if (requestId === angleRequestRef.current) {
        setAngleLoading(false);
      }
    }
  }

  async function createPost(mode: PostMode = "default") {
    if (!selectedIdea || !angle) return;

    setPostLoading(true);
    setError("");
    setCopied(false);

    const modeInstruction =
      mode === "sharper"
        ? `Make the argument sharper. Remove soft wording, obvious statements, and unnecessary setup. Give the reader one clear insight they may disagree with, while staying fair and evidence-grounded.`
        : mode === "human"
          ? `Make it more human. Use natural sentence rhythm, concrete language, and a voice that sounds like an intelligent professional rather than an AI writer. Do not add fake personal experiences or "I've noticed" style claims.`
          : mode === "regenerate"
            ? `Write a genuinely different version from the previous attempt. Take a different route into the same selected angle; do not merely swap synonyms or rearrange sentences.`
            : `Write the strongest natural version of the selected angle.`;

    const selectedAngle = suggestedAngles.find((item) => item.text === angle);
    const prompt = `You are PostCraft AI, an editorial thinking partner.

Your job is to turn a news development into a LinkedIn post with a clear point of view. The reader should learn something, reconsider something, or see a useful implication they had not considered.

You are NOT a topic explainer.
You are NOT a corporate copywriter.
You are NOT writing a news summary.

INPUT:

Topic: ${topic === "Custom topic" ? customTopic.trim() : topic}
News headline: ${selectedIdea.title}
News summary: ${selectedIdea.description || "No reliable summary was supplied."}
Why this story is worth exploring: ${selectedIdea.whyItMatters}
Source: ${selectedIdea.source}
Selected angle: ${angle}
Why this angle works: ${selectedAngle?.why || "It gives the story a specific point of view."}

WRITING PROCESS:
1. Identify the real tension or overlooked implication behind the selected angle.
2. Decide the one sentence the writer most wants the reader to remember.
3. Build the post around that idea.
4. Use the supplied news only as context and evidence; do not invent supporting facts.
5. End with the implication, a memorable observation, or a genuinely useful question only if it adds value.

STYLE:
- 130-190 words.
- 4-7 short paragraphs.
- Open with the idea, not a generic introduction.
- Sound like a thoughtful professional speaking plainly.
- Specific beats clever.
- Reasoning beats hype.
- Keep ONE central argument.
- Let the selected angle drive the whole post.
- It is okay to take a position, but distinguish opinion from fact.
- Do not force a question at the end.

${modeInstruction}

DO NOT:
- repeat the headline as the opening
- restate the article paragraph by paragraph
- invent statistics, quotes, examples, events, people, or facts
- treat an uncertain or sensational headline as established fact
- use fake personal experiences
- use "I've noticed", "I've been thinking", or similar manufactured personal framing
- use "In today's rapidly changing world", "game changer", "unlock potential", "drive real business value", or corporate jargon
- use artificial controversy
- use a title or heading
- use more than 2 hashtags, and preferably use none
- end with "What do you think?", "Agree?", or "Thoughts?"
- use excessive emojis
- repeat the same idea in different words

Return ONLY the finished LinkedIn post.`;

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "Post generation failed");
      }

      setPost(typeof data?.text === "string" ? data.text.trim() : "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Post generation failed"
      );
    } finally {
      setPostLoading(false);
    }
  }

  async function copyPost() {
    if (!post) return;

    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy the post to your clipboard");
    }
  }

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="flex items-center justify-between">
          <div>
            <div className="text-xl font-semibold tracking-tight">
              POSTCRAFT AI
            </div>
            <div className="mt-1 text-sm text-neutral-500">
              Find something worth saying.
            </div>
          </div>

          <div className="rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600">
            Guest Mode
          </div>
        </header>

        <section className="mt-16">
          <h1 className="text-4xl font-semibold tracking-tight">
            Find something worth saying.
          </h1>

          <p className="mt-3 max-w-2xl text-lg text-neutral-500">
            Discover timely ideas, choose your point of view, and turn it into
            a LinkedIn-ready post.
          </p>
        </section>

        <section className="mt-10">
          <div className="text-sm font-medium text-neutral-700">
            Choose a topic
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {topics.map((item) => (
              <button
                key={item}
                onClick={() => setTopic(item)}
                className={`rounded-full border px-4 py-2 text-sm transition ${
                  topic === item
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          {topic === "Custom topic" && (
            <input
              value={customTopic}
              onChange={(event) => setCustomTopic(event.target.value)}
              placeholder="Enter a topic, company, industry, or question"
              className="mt-4 w-full max-w-xl rounded-lg border border-neutral-300 px-4 py-3 text-sm outline-none focus:border-neutral-900"
            />
          )}

          <button
            onClick={discoverIdeas}
            disabled={
              loading ||
              (topic === "Custom topic" && !customTopic.trim())
            }
            className="mt-5 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Finding ideas..." : "Discover ideas"}
          </button>
        </section>

        {!loading && ideas.length === 0 && !error && (
          <p className="mt-8 text-sm text-neutral-400">
            Choose a topic and discover a few ideas worth exploring.
          </p>
        )}

        {ideas.length > 0 && (
          <section className="mt-12">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-700">
                  Worth exploring
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  Recent developments you could have something meaningful to
                  say about.
                </p>
              </div>

              <div className="text-sm text-neutral-400">
                {ideas.length} ideas
              </div>
            </div>

            <div className="mt-5 space-y-4">
              {ideas.map((idea) => {
                const selected = selectedIdea?.url === idea.url;

                return (
                  <article
                    key={idea.url}
                    className={`rounded-2xl border p-5 transition ${
                      selected
                        ? "border-neutral-900 ring-1 ring-neutral-900"
                        : "border-neutral-200"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="max-w-3xl">
                        <h2 className="text-lg font-semibold leading-7">
                          {idea.title}
                        </h2>

                        <div className="mt-2 text-xs text-neutral-500">
                          {idea.source}
                          {idea.publishedAt
                            ? ` · ${formatDate(idea.publishedAt)}`
                            : ""}
                        </div>

                        {idea.description && (
                          <p className="mt-4 text-sm leading-6 text-neutral-700">
                            {idea.description}
                          </p>
                        )}

                        <div className="mt-4">
                          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
                            Why this may be worth exploring
                          </div>

                          <p className="mt-1 text-sm leading-6 text-neutral-600">
                            {idea.whyItMatters}
                          </p>
                        </div>

                        <a
                          href={idea.url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-4 inline-block text-sm font-medium text-neutral-700 underline underline-offset-4"
                        >
                          View source
                        </a>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedIdea(idea);
                          setPost("");
                          setCopied(false);
                          setError("");
                          setAngle("");
                          setSuggestedAngles([]);
                          generateAngles(idea);
                        }}
                        className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
                          selected
                            ? "bg-neutral-900 text-white"
                            : "border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-900"
                        }`}
                      >
                        {selected ? "Selected" : "Select this idea"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {selectedIdea && (
          <section className="mt-12 border-t border-neutral-200 pt-10">
            <div className="text-sm font-medium text-neutral-700">
              Choose your angle
            </div>
            <p className="mt-1 text-sm text-neutral-500">
              PostCraft found a few ways into this story. Pick the one you
              actually want to argue.
            </p>

            <div className="mt-3">
              {angleLoading ? (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-500">
                  Finding three angles worth exploring...
                </div>
              ) : suggestedAngles.length > 0 ? (
                <div className="grid gap-3 md:grid-cols-3">
                  {suggestedAngles.map((item) => (
                    <button
                      key={item.text}
                      onClick={() => setAngle(item.text)}
                      className={`rounded-xl border p-4 text-left transition ${
                        angle === item.text
                          ? "border-neutral-900 bg-neutral-900 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-400"
                      }`}
                    >
                      <div className="text-sm font-medium leading-6">{item.text}</div>
                      {item.why && (
                        <div
                          className={`mt-3 text-xs leading-5 ${
                            angle === item.text ? "text-neutral-300" : "text-neutral-500"
                          }`}
                        >
                          {item.why}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-neutral-500">
                  Select an idea to generate possible angles.
                </div>
              )}
            </div>

            <button
              onClick={() => createPost()}
              disabled={postLoading || angleLoading || !angle}
              className="mt-5 rounded-lg bg-neutral-900 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {postLoading ? "Creating post..." : "Create LinkedIn post"}
            </button>
          </section>
        )}

        {post && (
          <section className="mt-12 border-t border-neutral-200 pt-10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium text-neutral-700">
                  Your post
                </div>
                <p className="mt-1 text-sm text-neutral-500">
                  Built around your selected story and angle.
                </p>
              </div>

              <button
                onClick={copyPost}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="mt-4 whitespace-pre-wrap rounded-2xl border border-neutral-200 bg-neutral-50 p-6 text-[15px] leading-7">
              {post}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => createPost("regenerate")}
                disabled={postLoading}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50"
              >
                {postLoading ? "Working..." : "Regenerate"}
              </button>
              <button
                onClick={() => createPost("sharper")}
                disabled={postLoading}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50"
              >
                Make sharper
              </button>
              <button
                onClick={() => createPost("human")}
                disabled={postLoading}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-800 hover:border-neutral-900 disabled:opacity-50"
              >
                Make more human
              </button>
            </div>
          </section>
        )}

        {error && (
          <div className="mt-8 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>
    </main>
  );
}








