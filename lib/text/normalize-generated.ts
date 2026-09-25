import { decodeHtmlEntities } from "@/lib/text/decode-html";

/**
 * Normalize text returned by an LLM or copied from a publisher before it is
 * displayed or sent to LinkedIn. This removes formatting/control artifacts
 * without stripping normal punctuation from human-written prose.
 */
export function normalizeGeneratedText(value: string, options: { plainPunctuation?: boolean } = {}) {
  const plainPunctuation = options.plainPunctuation === true;

  let text = decodeHtmlEntities(value)
    .replace(/\uFEFF/g, "")
    .replace(/[\u200B-\u200D\u2060]/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Common UTF-8 -> Windows-1252 mojibake that can survive HTML decoding.
    .replace(/â€™/g, "’")
    .replace(/â€˜/g, "‘")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€¦/g, "…")
    .replace(/Â·/g, "·")
    .replace(/Â /g, " ")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ã¡/g, "á")
    .replace(/Ã³/g, "ó")
    .replace(/Ãº/g, "ú")
    .replace(/Ã±/g, "ñ")
    .replace(/Ã§/g, "ç")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã¶/g, "ö")
    .replace(/Ã¼/g, "ü")
    // Remove Markdown/code formatting that should never be published as prose.
    .replace(/^\s*\`\`\`(?:json|text|markdown)?\s*/i, "")
    .replace(/\s*\`\`\`\s*$/i, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\*\*([^\n]*?)\*\*/g, "$1")
    .replace(/__([^\n]*?)__/g, "$1")
    .replace(/\*([^\n]*?)\*/g, "$1")
    .replace(/_([^\n]*?)_/g, "$1")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    // Remove stray HTML tags if a model echoes markup.
    .replace(/<\/?(?:p|strong|em|b|i|br|div|span|section|article)[^>]*>/gi, "")
    .normalize("NFKC")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (plainPunctuation) {
    text = text
      .replace(/[“”„‟]/g, '"')
      .replace(/[‘’‚‛]/g, "'")
      .replace(/[–—−]/g, "-")
      .replace(/…/g, "...")
      .replace(/[•·]/g, "-")
      .replace(/[\u00A0]/g, " ");
  }

  return text.trim();
}
