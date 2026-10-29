/*
  FILE: config/legal.ts
  WHAT IT'S FOR: The wording and facts used by the footer, Privacy Policy, and Terms of Use pages in
  one place: the minimum age, the problem-gambling helpline, and the "last updated" date. Change a
  phone number or date here and every page updates.
  WHO USES IT: components/SiteFooter.tsx, app/(legal)/privacy/page.tsx, app/(legal)/terms/page.tsx.
  WHY THIS NAME: It holds legal-page settings. It lives in config/ with the other settings files
  and ends in .ts because it shows nothing on screen.
*/

/** The minimum age to use the site. */
export const MINIMUM_AGE = 21;

/** The National Problem Gambling Helpline: free, private, 24/7 in the US. */
export const HELPLINE = {
  name: "National Problem Gambling Helpline",
  phoneLabel: "1-800-GAMBLER",
  // The digits behind the letters (G-A-M-B-L-E-R), used for tap-to-call links.
  phoneDigits: "18004262537",
  websiteLabel: "ncpgambling.org",
  websiteUrl: "https://www.ncpgambling.org",
} as const;

/** The short "for reference only" sentence shown in the footer. */
export const REFERENCE_ONLY_NOTICE =
  "For reference only. The Vegas Backroom doesn't take bets or handle real money.";

/** When the Privacy Policy and Terms of Use were last changed. */
export const LEGAL_LAST_UPDATED = "October 28, 2026";
