const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  minus: "−",
  hellip: "…",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  sbquo: "‚",
  bdquo: "„",
  prime: "′",
  Prime: "″",
  bull: "•",
  middot: "·",
  hyphen: "‐",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  rupee: "₹",
  sect: "§",
  para: "¶",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  micro: "µ",
  aacute: "á",
  Aacute: "Á",
  eacute: "é",
  Eacute: "É",
  iacute: "í",
  Iacute: "Í",
  oacute: "ó",
  Oacute: "Ó",
  uacute: "ú",
  Uacute: "Ú",
  yacute: "ý",
  Yacute: "Ý",
  agrave: "à",
  Agrave: "À",
  egrave: "è",
  Egrave: "È",
  igrave: "ì",
  Igrave: "Ì",
  ograve: "ò",
  Ograve: "Ò",
  ugrave: "ù",
  Ugrave: "Ù",
  acirc: "â",
  Acirc: "Â",
  ecirc: "ê",
  Ecirc: "Ê",
  icirc: "î",
  Icirc: "Î",
  ocirc: "ô",
  Ocirc: "Ô",
  ucirc: "û",
  Ucirc: "Û",
  auml: "ä",
  Auml: "Ä",
  euml: "ë",
  Euml: "Ë",
  iuml: "ï",
  Iuml: "Ï",
  ouml: "ö",
  Ouml: "Ö",
  uuml: "ü",
  Uuml: "Ü",
  ntilde: "ñ",
  Ntilde: "Ñ",
  ccedil: "ç",
  Ccedil: "Ç",
  aring: "å",
  Aring: "Å",
  oslash: "ø",
  Oslash: "Ø",
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&([a-z][a-z0-9]+);/gi, (match, name: string) => NAMED_ENTITIES[name] ?? match)
    .replace(/&#(\d+);/g, (match, code: string) => {
      const point = Number(code);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, code: string) => {
      const point = Number.parseInt(code, 16);
      return Number.isFinite(point) && point >= 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : match;
    })
    .replace(/\\u00a0/gi, " ")
    .replace(/\\u00c2\\u00b7/g, "·")
    .replace(/â€™/g, "’")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€¦/g, "…");
}
