/*
  FILE: app/(legal)/terms/page.tsx
  WHAT IT'S FOR: The Terms of Use at /terms: the rules for using The Vegas Backroom, including that it is
  for reference only, 21+, and that odds and scores may be wrong or late.
  WHO USES IT: Linked from the footer (components/SiteFooter.tsx).
  WHY THIS NAME: "page.tsx" is the file Next.js needs for a page. The folder name "terms" makes the
  address /terms. It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import TemplateNotice from "@/components/legal/TemplateNotice";
import { HELPLINE, LEGAL_LAST_UPDATED, MINIMUM_AGE } from "@/config/legal";

/* The browser tab title: "Terms of Use | The Vegas Backroom". */
export const metadata: Metadata = { title: "Terms of Use" };

/* TermsPage: plain text, so it works with JavaScript off. */
export default function TermsPage() {
  return (
    <>
      <h1 className="text-3xl text-gold">Terms of Use</h1>
      <p className="text-xs text-muted">Last updated {LEGAL_LAST_UPDATED}</p>
      <TemplateNotice />

      <section className="space-y-2">
        <h2 className="text-xl text-text">For reference only</h2>
        <p className="text-sm text-muted">
          The Vegas Backroom helps you compare odds, read news and stats, and build practice bet slips. It is not a
          sportsbook. It doesn&apos;t take bets, hold money, or pay out winnings, and an &quot;estimated payout&quot; is
          only an estimate with pretend money.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Who can use it</h2>
        <p className="text-sm text-muted">
          You must be {MINIMUM_AGE} or older, and sign up with a valid invite code. Betting laws differ by place; it is your
          job to follow the laws where you live.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">No guarantees</h2>
        <p className="text-sm text-muted">
          Odds, scores, stats and news come from outside services and may be wrong, missing, or late. Check a
          sportsbook&apos;s own site for its real price before you rely on anything here. Nothing on this site is
          financial or betting advice, and no result is promised.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Your account</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Keep your password private. You are responsible for what happens in your account.</li>
          <li>Don&apos;t try to break, overload, or get around the site&apos;s protections.</li>
          <li>We may limit or close accounts that misuse the site. You can delete your own account on the Profile page.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Limits on our responsibility</h2>
        <p className="text-sm text-muted">
          The site is provided &quot;as is.&quot; To the fullest extent the law allows, we aren&apos;t responsible for losses
          from using it or from bets you place elsewhere.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Gamble responsibly</h2>
        <p className="text-sm text-muted">
          If gambling is a problem for you or someone you know, call the {HELPLINE.name} at {HELPLINE.phoneLabel} or visit{" "}
          <a href={HELPLINE.websiteUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-gold underline-offset-4 hover:underline">
            {HELPLINE.websiteLabel}
          </a>
          .
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Changes</h2>
        <p className="text-sm text-muted">If these terms change, the date at the top changes too.</p>
      </section>
    </>
  );
}
