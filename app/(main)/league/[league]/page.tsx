/*
  FILE: app/(main)/league/[league]/page.tsx
  WHAT IT'S FOR: A league's page, e.g. /league/nfl. For now it's a placeholder; the
  real list of matchups comes in Section 9. It already shows "not found" for a league
  that doesn't exist (like /league/xyz) and a "coming soon" note for leagues that
  are turned off (like /league/nba).
  WHO USES IT: Next.js shows it for any address that starts with /league/. The Feed links to /league/nfl.
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

/* LeaguePage: checks the league in the address, then shows the right placeholder. */
export default async function LeaguePage(props: PageProps<"/league/[league]">) {
  const { league: slug } = await props.params;
  const league = getLeague(slug);

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
    <PagePlaceholder
      title={league.label}
      description={`Every upcoming ${league.label} matchup, soonest first, with Spread, Total, and Winner odds.`}
      section="Section 9"
    />
  );
}
