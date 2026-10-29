/*
  FILE: components/SiteFooter.tsx
  WHAT IT'S FOR: The small notice at the bottom of every page: the "for reference only" disclaimer, the
  21+ notice, the responsible-gambling help line and website, and links to the Privacy Policy and Terms of Use.
  WHO USES IT: app/(main)/layout.tsx, app/(auth)/layout.tsx, and app/(legal)/layout.tsx.
  WHY THIS NAME: It's the footer for the whole site. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
// The age, helpline, and disclaimer words, from config/legal.ts (one place to change them).
import { HELPLINE, MINIMUM_AGE, REFERENCE_ONLY_NOTICE } from "@/config/legal";

/* SiteFooter: plain text and links, so it works with JavaScript off. */
export default function SiteFooter() {
  return (
    <footer aria-label="Site notices" className="mt-10 space-y-2 border-t border-line pt-5 text-xs leading-relaxed text-muted">
      <p>{REFERENCE_ONLY_NOTICE}</p>
      <p>
        You must be {MINIMUM_AGE} or older to use this site. Gambling problem? Call{" "}
        <a href={`tel:${HELPLINE.phoneDigits}`} className="font-semibold text-gold underline-offset-4 hover:underline">
          {HELPLINE.phoneLabel}
        </a>{" "}
        or visit{" "}
        <a
          href={HELPLINE.websiteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-gold underline-offset-4 hover:underline"
        >
          {HELPLINE.websiteLabel}
        </a>
        .
      </p>
      <p className="flex flex-wrap gap-x-4 gap-y-1">
        <Link href="/privacy" className="underline-offset-4 hover:text-gold hover:underline">
          Privacy Policy
        </Link>
        <Link href="/terms" className="underline-offset-4 hover:text-gold hover:underline">
          Terms of Use
        </Link>
      </p>
    </footer>
  );
}
