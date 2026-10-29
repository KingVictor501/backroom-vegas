/*
  FILE: app/(legal)/privacy/page.tsx
  WHAT IT'S FOR: The Privacy Policy at /privacy: what The Vegas Backroom collects, why, who else sees
  anything, and how to delete it. Written to match what the app really does.
  WHO USES IT: Linked from the footer (components/SiteFooter.tsx).
  WHY THIS NAME: "page.tsx" is the file Next.js needs for a page. The folder name "privacy" makes the
  address /privacy. It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import TemplateNotice from "@/components/legal/TemplateNotice";
import { LEGAL_LAST_UPDATED } from "@/config/legal";

/* The browser tab title: "Privacy Policy | The Vegas Backroom". */
export const metadata: Metadata = { title: "Privacy Policy" };

/* PrivacyPage: plain text, so it works with JavaScript off. */
export default function PrivacyPage() {
  return (
    <>
      <h1 className="text-3xl text-gold">Privacy Policy</h1>
      <p className="text-xs text-muted">Last updated {LEGAL_LAST_UPDATED}</p>
      <TemplateNotice />

      <section className="space-y-2">
        <h2 className="text-xl text-text">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Your email address and a scrambled (hashed) version of your password. We never store or see your real password.</li>
          <li>The bet slips you build, your wager amounts, and your chosen sportsbook.</li>
          <li>The invite code you used to sign up (so we know which code was used).</li>
          <li>
            Sign-in attempt counts, tied to the email typed and your internet address (IP address), kept for about 15
            minutes to stop password guessing.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Cookies</h2>
        <p className="text-sm text-muted">
          We use only cookies the site needs to work: one that keeps you logged in, and one that remembers a valid
          invite code while you sign up. We don&apos;t use advertising or tracking cookies.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Who else sees your information</h2>
        <p className="text-sm text-muted">
          We don&apos;t sell your information. Our servers ask outside services (ESPN, The Odds API, and an NFL data
          service) for scores, news and odds. Those requests don&apos;t include your email or your slips. Our hosting
          (Vercel) and database (MongoDB Atlas) providers store the site&apos;s data for us.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Real money</h2>
        <p className="text-sm text-muted">
          The Vegas Backroom is a reference tool. Nobody places real bets here, and we never ask for payment details or
          card numbers.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Your choices</h2>
        <p className="text-sm text-muted">
          You can change your email or password, or delete your account, on the Profile page. Deleting your account
          permanently erases your account and all of your bet slips.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Age</h2>
        <p className="text-sm text-muted">This site is for people 21 or older. We don&apos;t knowingly collect information from anyone younger.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-xl text-text">Changes</h2>
        <p className="text-sm text-muted">If this policy changes, the date at the top changes too.</p>
      </section>
    </>
  );
}
