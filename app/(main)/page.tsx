/*
  FILE: app/(main)/page.tsx
  WHAT IT'S FOR: The Feed (homepage), at the address "/". The app name, then
  (following your LAYOUT section) the search bar, league tabs, bet-type
  buttons, and this week's and next week's NFL games with odds. The NFL news
  section is added in Section 14.
  WHO USES IT: Next.js shows it when someone visits the site's main address.
  The "Home" link in the menu points here.
  WHY THIS NAME: A page.tsx directly inside a folder is that folder's main page. Since
  "(main)" is a route group (not part of the address), this is the page for "/".
  It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// getLeague and DEFAULT_LEAGUE_SLUG from config/leagues.ts: the Feed shows the default league (NFL).
import { DEFAULT_LEAGUE_SLUG, getLeague } from "@/config/leagues";
// requireUser from lib/auth/dal.ts: the logged-in user (for their sportsbook).
import { requireUser } from "@/lib/auth/dal";
// The server part that loads the games, from components/feed.
import LeagueGames from "@/components/feed/LeagueGames";

/* The browser tab title. absolute = show just "The Vegas Backroom" without the "| The Vegas Backroom" ending. */
export const metadata: Metadata = { title: { absolute: "The Vegas Backroom" } };

/*
  FeedPage: runs on the server.
  The app name shows top left on phones and tablets. On desktop the sidebar
  already shows it, so the heading is only kept for screen readers there ("lg:sr-only").
*/
export default async function FeedPage() {
  const user = await requireUser();
  const league = getLeague(DEFAULT_LEAGUE_SLUG);
  if (!league) throw new Error(`The default league "${DEFAULT_LEAGUE_SLUG}" is missing from config/leagues.ts.`);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl text-gold lg:sr-only">The Vegas Backroom</h1>
      <LeagueGames league={league} user={user} />
    </div>
  );
}
