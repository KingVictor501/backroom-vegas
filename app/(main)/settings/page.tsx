/*
  FILE: app/(main)/settings/page.tsx
  WHAT IT'S FOR: The Settings page, at /settings:
  - big cards to pick your sportsbook (Hard Rock Bet, BetMGM).
    The chosen one has a gold outline and is saved to your account with a
    Server Action, so the odds on every page switch to that book.
  - your email, a button to the Profile page (change email or password, delete account), and the Log out button
  WHO USES IT: Next.js shows it when someone visits /settings. The "Settings"
  menu link and every "Change" / "Try another sportsbook" link point here.
  WHY THIS NAME: The folder "settings" becomes the web address, and Next.js requires
  the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The Log out button (calls the logout Server Action) from components/auth/LogoutButton.tsx.
import LogoutButton from "@/components/auth/LogoutButton";
// The sportsbook cards, from components/settings.
import SportsbookPicker from "@/components/settings/SportsbookPicker";
// The league (only NFL for now), from config/leagues.ts.
import { DEFAULT_LEAGUE_SLUG } from "@/config/leagues";
// requireUser from lib/auth/dal.ts: gets the logged-in user, or sends the visitor to /login.
import { requireUser } from "@/lib/auth/dal";
// The upcoming games with odds, from lib/services/games.ts (for "Odds on 13 of 28 games").
import { getUpcomingGamesWithLines } from "@/lib/services/games";
import { SPORTSBOOK_IDS, type LeagueSlug, type SportsbookId } from "@/types";

/* The browser tab title: "Settings | The Vegas Backroom". */
export const metadata: Metadata = { title: "Settings" };

/*
  oddsCoverage: for each book, how many upcoming games it has odds for. It
  reuses the odds the Feed already saved (one request covers all three books),
  so it costs no extra Odds API credits. null if it couldn't be checked.
*/
async function oddsCoverage(): Promise<{ counts: Record<SportsbookId, number>; total: number } | null> {
  try {
    const league = DEFAULT_LEAGUE_SLUG as LeagueSlug;
    const results = await Promise.all(SPORTSBOOK_IDS.map((book) => getUpcomingGamesWithLines(league, book)));
    if (results.some((result) => result.oddsUnavailable)) return null;
    const counts = Object.fromEntries(
      SPORTSBOOK_IDS.map((book, index) => [book, results[index].games.filter((game) => game.lines !== null).length]),
    ) as Record<SportsbookId, number>;
    return { counts, total: results[0].games.length };
  } catch {
    return null;
  }
}

/* SettingsPage: loads the logged-in user on the server (never in the browser). */
export default async function SettingsPage() {
  const [user, coverage] = await Promise.all([requireUser(), oddsCoverage()]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-3xl text-gold">Settings</h1>

      <section aria-labelledby="sportsbook-heading" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="sportsbook-heading" className="text-xl text-text">
          Sportsbook
        </h2>
        <div className="mt-3">
          <SportsbookPicker current={user.preferredSportsbook} gameCounts={coverage?.counts ?? null} totalGames={coverage?.total ?? 0} />
        </div>
        <p className="mt-4 text-xs text-muted">
          Picks already on your bet slips keep the sportsbook they came from.
        </p>
      </section>

      <section aria-labelledby="account-heading" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="account-heading" className="text-xl text-text">
          Account
        </h2>
        <p className="mt-3 text-sm text-muted">Logged in as</p>
        {/* React shows the email as plain text, so it can't be used to inject code. */}
        <p className="mt-1 break-all font-medium text-text">{user.email}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {/* Next.js's Link switches pages without reloading the whole site. */}
          <Link
            href="/profile"
            className="rounded-full bg-gold px-6 py-2.5 font-semibold text-bg transition-colors hover:bg-gold-bright"
          >
            Manage profile
          </Link>
          <LogoutButton />
        </div>
      </section>
    </div>
  );
}
