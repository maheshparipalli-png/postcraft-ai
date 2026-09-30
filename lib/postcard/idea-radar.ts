export type IdeaRadarPostcardContent = {
  headline: string;
  body: string;
  closing: string;
};

function splitSentences(text: string) {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

function takeSentences(sentences: string[], start: number, minWords: number, maxWords: number) {
  const selected: string[] = [];
  let count = 0;

  for (let index = start; index < sentences.length; index += 1) {
    const next = sentences[index];
    const nextCount = wordCount(next);

    if (selected.length > 0 && count + nextCount > maxWords) break;

    selected.push(next);
    count += nextCount;

    if (count >= minWords) break;
  }

  return selected.join(" ");
}

/**
 * Shared Idea Radar -> PostCard framework.
 *
 * The LinkedIn post can be 200-300 words, but a PostCard needs a compact,
 * self-contained argument. We therefore map every topic to the same structure:
 * 1. Headline: the opening hook/question.
 * 2. Body: the central explanation, with enough context to stand on its own.
 * 3. Closing: the final takeaway/question.
 *
 * This is deliberately deterministic so PostCard quality does not depend on
 * the topic, category, or AI provider.
 */
export function buildIdeaRadarPostcardContent(
  generatedPost: string,
  fallbackAngle: string,
): IdeaRadarPostcardContent {
  const sentences = splitSentences(generatedPost);

  if (!sentences.length) {
    const fallback = fallbackAngle.replace(/^.*?:\s*/, "").trim() || "A useful idea worth thinking about.";
    return {
      headline: fallback,
      body: fallback,
      closing: "What does this idea change about the way we work or decide?",
    };
  }

  const headline = sentences[0];

  if (sentences.length === 1) {
    return {
      headline,
      body: headline,
      closing: "What does this idea change about the way we think or act?",
    };
  }

  const lastSentence = sentences[sentences.length - 1];
  const middleSentences = sentences.slice(1, -1);

  // Keep the visual readable while giving the middle section enough substance
  // to explain the idea rather than merely repeating the headline.
  let body = takeSentences(middleSentences, 0, 65, 105);

  // If the middle is unusually short, include the final sentence in the body
  // and use the preceding sentence as the closing.
  if (wordCount(body) < 50 && middleSentences.length > 1) {
    body = takeSentences(sentences.slice(1), 0, 65, 105);
  }

  if (!body) {
    body = lastSentence;
  }

  let closing = lastSentence;
  if (wordCount(closing) > 35 && middleSentences.length) {
    closing = middleSentences[middleSentences.length - 1];
  }

  return { headline, body, closing };
}
