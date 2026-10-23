/*
  FILE: app/(main)/league/[league]/page.tsx
  WHAT IT'S FOR: A league's page, e.g. /league/nfl: every upcoming matchup,
  soonest first, each with the day and time and a Spread / Total / Winner odds
  table. It shows "not found" for a league that doesn't exist (like /league/xyz)
  and a "coming soon" note for leagues that are turned off (like /league/nba).
  WHO USES IT: Next.js shows it for any address that starts with /league/. The
  NFL league tab links here.
  WHY THIS NAME: The square brackets in "[league]" make it a "dynamic" folder:
  whatever is typed in that part of the address (nfl, nba, ...) gets handed to the
  page as "league". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
// notFound: a Next.js helper that stops and shows the app's "not found" page (app/not-found.tsx).
import { notFound } from "next/navigation";
// The shared "coming soon" box from the components folder.
import PagePlaceholder from "@/components/PagePlaceholder";
// The league list from config/leagues.ts, the one place that knows which leagues exist and which are on.
import { getLeague } from "@/config/leagues";
// The server part that loads and shows the games, from components/feed.
import LeagueGames from "@/components/feed/LeagueGames";
// requireUser from lib/auth/dal.ts: the logged-in user (for their sportsbook).
import { requireUser } from "@/lib/auth/dal";

/*
  generateMetadata: sets the browser tab title to the league name, like "NFL | The Vegas Backroom".
  PageProps<"/league/[league]"> is a type Next.js generates. It knows this page receives a "league" value.
  "params" arrives as a Promise (a value that's ready a moment later), so we "await" it.
*/
export async function generateMetadata(
  props: PageProps<"/league/[league]">,
): Promise<Metadata> {
  const { league: slug } = await props.params;
  return { title: getLeague(slug)?.label ?? "League not found" };
}

/* LeaguePage: runs on the server. Checks the league in the address, then shows its games. */
export default async function LeaguePage(props: PageProps<"/league/[league]">) {
  const { league: slug } = await props.params;
  const league = getLeague(slug);
  const user = await requireUser();

  // No league has this slug (someone typed /league/xyz), so show the "not found" page instead of crashing.
  if (!league) notFound();

  // The league exists but is turned off in config/leagues.ts.
  if (!league.enabled) {
    return (
      <PagePlaceholder
        title={league.label}
        description={`${league.fullName} isn't available yet.`}
        section="a future update"
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl text-gold">{league.label} games</h1>
      <LeagueGames league={league} user={user} />
    </div>
  );
}
