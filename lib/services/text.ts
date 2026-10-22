/*
  FILE: lib/services/text.ts
  WHAT IT'S FOR: Turns text that might contain HTML (like "<b>Chiefs</b> win &amp; cover")
  into plain text ("Chiefs win & cover"). Every news headline and description
  goes through this before it reaches a page.
  SECURITY: this is how we avoid dangerouslySetInnerHTML. We never show
  outside HTML as HTML. We strip it to plain text, and React then shows that
  text safely, so a sneaky <script> in a news feed can't run in the app (XSS).
  WHO USES IT: lib/services/espn/news.ts and lib/services/espn/injuries.ts.
  WHY THIS NAME: It's about text. It ends in .ts because it shows nothing on screen.
*/

/*
  NAMED_ENTITIES: the most common HTML "entities", special codes for characters,
  like &amp; for "&". Anything not listed is left as-is.
*/
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
};

/*
  toPlainText: removes HTML tags, turns entities back into characters, and tidies spaces.
  1. Drops <script> and <style> blocks completely (including what's inside them).
  2. Removes every other tag, like <b> or <a href="...">.
  3. Decodes entities: &amp; → &, &#39; → ', &#x2019; → '.
  4. Squashes runs of spaces and line breaks into single spaces.
  Even if something slipped through, React would still show it as text, never run it.
*/
export function toPlainText(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/*
  normalizeName: makes two spellings of a name comparable.
  "Kenneth Walker III", "kenneth walker" and "Kenneth Walker" all become
  "kenneth walker", and "A.J. Brown" and "AJ Brown" both become "aj brown".
  Used to match The Odds API's player and team names to ESPN's, because the two
  APIs don't share IDs.
*/
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    // Remove accents: "é" → "e".
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    // Remove periods, apostrophes and commas: "A.J." → "aj", "Ja'Marr" → "jamarr".
    .replace(/[.'’,]/g, "")
    // Remove name suffixes at the end.
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
