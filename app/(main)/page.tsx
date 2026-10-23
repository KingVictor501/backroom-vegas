/*
  FILE: app/(main)/page.tsx
  WHAT IT'S FOR: The Feed (homepage), at the address "/". The app name, then
  (following your LAYOUT section) the search bar, league tabs, bet-type
  buttons, and this week's and next week's NFL games with odds, then the NFL
  news box (which loads in the browser, with its own loading/error/empty looks).
  Add ?news=slow, ?news=bad-url, or ?news=empty to the address to test the news box.
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
// The server part that loads the games, and the browser-loaded news box, from components/feed.
import LeagueGames from "@/components/feed/LeagueGames";
import NewsWidget, { type NewsTestMode } from "@/components/feed/NewsWidget";

/* NEWS_TEST_MODES: the only ?news= values the test switch accepts. Anything else means "normal". */
const NEWS_TEST_MODES: NewsTestMode[] = ["slow", "bad-url", "empty"];

/* The browser tab title. absolute = show just "The Vegas Backroom" without the "| The Vegas Backroom" ending. */
export const metadata: Metadata = { title: { absolute: "The Vegas Backroom" } };

/*
  FeedPage: runs on the server.
  The app name shows top left on phones and tablets. On desktop the sidebar
  already shows it, so the heading is only kept for screen readers there ("lg:sr-only").
*/
export default async function FeedPage(props: PageProps<"/">) {
  const [user, search] = await Promise.all([requireUser(), props.searchParams]);
  const requested = Array.isArray(search.news) ? search.news[0] : search.news;
  const newsMode: NewsTestMode = NEWS_TEST_MODES.find((mode) => mode === requested) ?? "normal";
  const league = getLeague(DEFAULT_LEAGUE_SLUG);
  if (!league) throw new Error(`The default league "${DEFAULT_LEAGUE_SLUG}" is missing from config/leagues.ts.`);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl text-gold lg:sr-only">The Vegas Backroom</h1>
      <LeagueGames league={league} user={user} />
      {/* key: switching the test mode starts the box fresh, in the loading look. */}
      <NewsWidget key={newsMode} mode={newsMode} />
    </div>
  );
}
