export function normalizeGeneratedText(
  value: string,
  options?: { plainPunctuation?: boolean }
): string {
  let text = String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (options?.plainPunctuation) {
    text = text
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/…/g, "...");
  }

  return text;
}
