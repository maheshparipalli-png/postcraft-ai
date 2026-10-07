import { normalizeGeneratedText } from "@/lib/text/normalize-generated";

export function sanitizeLinkedInPost(value: string) {
  return normalizeGeneratedText(value, { plainPunctuation: true })
    .replace(/^\s*(?:LinkedIn post|Post):\s*/i, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`(.*?)`/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s*$/gm, "")
    .replace(/^\s*\d+[.)]\s*$/gm, "")
    .replace(/
+\s*(?:Source|Original source|Article source|Read the original article|Original article)\s*:?[^
]*(?:https?:\/\/\S+)?\s*$/i, "")
    .replace(/\bhttps?:\/\/\S+/gi, "")
    .replace(/
+\s*(?:Source|Original source|Article source)\s*:?\s*$/i, "")
    .replace(/[ \t]+
/g, "
")
    .replace(/
{3,}/g, "

")
    .trim();
}