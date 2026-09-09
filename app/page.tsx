"use client";

import { useState } from "react";

const topics = [
  "Technology",
  "Business",
  "Leadership",
  "Politics",
  "Geopolitics",
  "Economy",
  "Science",
  "Society",
];

const angles = [
  "Insight",
  "Opinion",
  "Contrarian",
  "Story",
  "Lesson",
  "Surprise me",
];

export default function Home() {
  const [topic, setTopic] = useState("Technology");
  const [selectedIdea, setSelectedIdea] = useState<number | null>(null);
  const [angle, setAngle] = useState("Insight");

  const ideas = [
    {
      title: "AI is changing how companies think about productivity",
      type: "Interesting development",
      source: "Example source",
    },
    {
      title: "The hidden cost of moving too quickly with AI",
      type: "Interesting connection",
      source: "Example source",
    },
    {
      title: "Why AI adoption is becoming a leadership problem",
      type: "Useful perspective",
      source: "Example source",
    },
  ];

  return (
    <main className="min-h-screen bg-[#f7faf8] text-[#17231f]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-bold tracking-[0.18em] text-[#2e7d68]">
              POSTCRAFT AI
            </div>
            <div className="rounded-full bg-[#eaf3ee] px-3 py-1.5 text-xs font-semibold text-[#5d7469]">
              Guest Mode
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            Find something worth saying.
          </h1>

          <p className="mt-3 max-w-2xl text-base text-[#72817a]">
            Discover what matters, choose your point of view, and turn it into
            a thoughtful LinkedIn post.
          </p>
        </header>

        <section className="rounded-2xl border border-[#dde7e2] bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold">What do you want to talk about?</h2>

          <div className="mt-4 flex flex-wrap gap-2">
            {topics.map((item) => (
              <button
                key={item}
                onClick={() => setTopic(item)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  topic === item
                    ? "border-[#77b7a2] bg-[#e5f3ee] text-[#216a57]"
                    : "border-[#dde7e2] bg-white text-[#4a5a53] hover:bg-[#f7faf8]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>

          <button className="mt-6 w-full rounded-xl bg-[#216a57] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#195b49]">
            Discover ideas
          </button>
        </section>

        <section className="mt-8">
          <div className="mb-4">
            <h2 className="text-lg font-bold">
              Ideas worth exploring
            </h2>
            <p className="mt-1 text-sm text-[#72817a]">
              A preview of the kind of opportunities PostCraft will surface.
            </p>
          </div>

          <div className="space-y-3">
            {ideas.map((idea, index) => (
              <button
                key={idea.title}
                onClick={() => setSelectedIdea(index)}
                className={`w-full rounded-2xl border bg-white p-5 text-left transition ${
                  selectedIdea === index
                    ? "border-[#77b7a2] ring-2 ring-[#e5f3ee]"
                    : "border-[#dde7e2] hover:border-[#b8cec4]"
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs font-bold uppercase tracking-wide text-[#2e7d68]">
                    {idea.type}
                  </span>

                  {selectedIdea === index && (
                    <span className="text-xs font-bold text-[#216a57]">
                      Selected
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-base font-bold">{idea.title}</h3>

                <p className="mt-2 text-sm text-[#72817a]">
                  {idea.source}
                </p>
              </button>
            ))}
          </div>
        </section>

        {selectedIdea !== null && (
          <section className="mt-8 rounded-2xl border border-[#dde7e2] bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold">How do you want to approach it?</h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {angles.map((item) => (
                <button
                  key={item}
                  onClick={() => setAngle(item)}
                  className={`rounded-xl border px-4 py-2.5 text-sm font-semibold ${
                    angle === item
                      ? "border-[#77b7a2] bg-[#e5f3ee] text-[#216a57]"
                      : "border-[#dde7e2] text-[#4a5a53]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <button className="mt-6 w-full rounded-xl bg-[#216a57] px-5 py-3 text-sm font-bold text-white">
              Create LinkedIn post
            </button>
          </section>
        )}
      </div>
    </main>
  );
}
