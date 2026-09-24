export type StatisticContent = {
  stat: string;
  statLabel: string;
};

const STATISTIC_PATTERN =
  /(?:₹|\$|€|£)?\s*\d+(?:\.\d+)?\s*(?:%|x|X|[kKmMbB]|bn|million|billion)?|\d+\s*(?:\/|in\s+of)\s*\d+/;

export function extractStatistic(value: string): string {
  const input = value.trim();
  if (!input) return "";

  const match = input.match(STATISTIC_PATTERN);
  return match?.[0]?.replace(/\s+/g, " ").trim() ?? "";
}

export function isCompactStatistic(value: string): boolean {
  const input = value.trim();
  if (!input || input.length > 18) return false;
  return input === extractStatistic(input);
}

export function normalizeStatisticContent(
  suppliedStat: string,
  generatedStat: string,
  generatedLabel: string,
): StatisticContent {
  const stat =
    (isCompactStatistic(suppliedStat) ? suppliedStat.trim() : "") ||
    extractStatistic(suppliedStat) ||
    (isCompactStatistic(generatedStat) ? generatedStat.trim() : "") ||
    extractStatistic(generatedStat);

  let statLabel = generatedLabel.trim();

  if (!statLabel && suppliedStat && stat) {
    const remainder = suppliedStat
      .replace(stat, "")
      .replace(/^\s*[-:;,|]+\s*/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (remainder) statLabel = remainder;
  }

  return {
    stat,
    statLabel: statLabel.slice(0, 120),
  };
}


/**
 * PostCard copy is rendered directly into SVG text. Normalize model/source
 * formatting first so Markdown/HTML artifacts never become visible card text.
 */
export function normalizePostcardText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\uFEFF/g, "")
    .replace(/^\s*\`\`\`(?:json|text|markdown)?\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^\n]*?)\*\*/g, "$1")
    .replace(/__([^\n]*?)__/g, "$1")
    .replace(/\*([^\n]*?)\*/g, "$1")
    .replace(/_([^\n]*?)_/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}
