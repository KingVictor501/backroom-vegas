/*
  FILE: config/siteNotice.ts
  WHAT IT'S FOR: The yellow notice bar shown at the very top of EVERY page, including the
  login and sign up pages (like "Site maintenance taking place..."). To show a notice, put
  the text here. To hide the bar completely, set SITE_NOTICE to null.
  WHO USES IT: app/layout.tsx (decides whether to show the bar) and components/SiteNotice.tsx
  (draws it).
  WHY THIS NAME: It's a site-wide setting, so it lives in the config folder with
  config/leagues.ts and config/sportsbooks.ts. It ends in .ts because it's plain data, not
  something on screen.
*/

/**
 * The notice text, or null for "no notice" (null is missing on purpose: nothing to show,
 * and the page layout makes no room for a bar).
 */
export const SITE_NOTICE: string | null =
  "Site maintenance taking place, some data may be missing and you may experience errors.";
