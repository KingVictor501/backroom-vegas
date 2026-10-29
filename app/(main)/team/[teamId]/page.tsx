/*
  FILE: app/(main)/team/[teamId]/page.tsx
  WHAT IT'S FOR: A team's page, e.g. /team/12 (Kansas City Chiefs), built on the server:
  1. FIRST: logo, name, record, division standing, and season stats
  2. then, loading in: the last 5 games with the team's stats from each game
  3. the key players (starting QB, top RBs, top receivers): last 5 games + average
  4. at the bottom: injuries and team news
  Parts 2 to 4 are wrapped in <Suspense>, so the top shows right away and
  each part fills in when its data arrives (Next.js "streams" the page).
  A fake team ID shows "Team not found". Stats only: no betting lines anywhere.
  WHO USES IT: Next.js shows it for any address that starts with /team/.
  Team logos on the matchup page, search results, and opponent names link here.
  WHY THIS NAME: "[teamId]" in square brackets is a dynamic folder: the ID in the
  address is handed to the page as "teamId". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
// The team page pieces, from components/team.
import TeamHeader from "@/components/team/TeamHeader";
import { InjuriesAndNews, KeyPlayers, RecentGames, SectionSkeleton, UpcomingSchedule } from "@/components/team/TeamSections";
// NbaTeamView: the basketball version of the team page. parseStatsLeague reads ?league=; isBasketball picks the view.
import NbaTeamView from "@/components/basketball/NbaTeamView";
import { isBasketball, parseStatsLeague } from "@/lib/leagues/links";
import { getNbaTeamOverview } from "@/lib/services/espn/basketball";
// requireUser from lib/auth/dal.ts: logged-in users only (checks the account still exists, too).
import { requireUser } from "@/lib/auth/dal";
// getTeamOverview from lib/services/espn/teams.ts: the top of the page (null for a fake team ID).
import { getTeamOverview } from "@/lib/services/espn/teams";

/*
  The league comes from the address's ?league= setting (lib/leagues/links.ts: parseStatsLeague). No setting
  means the NFL, so every older address works as before. Basketball teams use their own view.
*/

/* isTeamId: ESPN team IDs are only digits. Anything else can't be a real team. */
function isTeamId(id: string): boolean {
  return /^\d{1,12}$/.test(id);
}

/* generateMetadata: the browser tab title, like "Kansas City Chiefs | The Vegas Backroom". */
export async function generateMetadata(props: PageProps<"/team/[teamId]">): Promise<Metadata> {
  const [{ teamId }, search] = await Promise.all([props.params, props.searchParams]);
  const league = parseStatsLeague(search.league);
  if (!league || !isTeamId(teamId)) return { title: "Team" };
  const overview = isBasketball(league) ? await getNbaTeamOverview(teamId).catch(() => null) : await getTeamOverview(league, teamId).catch(() => null);
  return { title: overview?.team.displayName ?? "Team" };
}

/*
  TeamPage: runs on the server. It waits only for the top of the page; the
  rest streams in. (No loading.tsx here on purpose: waiting for the top first
  means a fake team ID gets a real "404 not found" answer.)
*/
export default async function TeamPage(props: PageProps<"/team/[teamId]">) {
  const [{ teamId }, search] = await Promise.all([props.params, props.searchParams]);
  await requireUser();
  // A league that doesn't exist, is off, or has no team pages is "not found" (null = not a valid league).
  const league = parseStatsLeague(search.league);
  if (!league || !isTeamId(teamId)) notFound();

  if (isBasketball(league)) {
    const nbaOverview = await getNbaTeamOverview(teamId);
    if (!nbaOverview) notFound();
    return <NbaTeamView overview={nbaOverview} />;
  }

  const overview = await getTeamOverview(league, teamId);
  if (!overview) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <TeamHeader overview={overview} />
      <Suspense fallback={<SectionSkeleton title="Last 5 games" />}>
        <RecentGames league={league} teamId={teamId} />
      </Suspense>
      {/* Under the last 5 games, closed until tapped. */}
      <Suspense fallback={<SectionSkeleton title="Remaining schedule" />}>
        <UpcomingSchedule league={league} teamId={teamId} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton title="Key players: last 5 games" />}>
        <KeyPlayers league={league} teamId={teamId} />
      </Suspense>
      <Suspense fallback={<SectionSkeleton title="Injuries and news" />}>
        <InjuriesAndNews league={league} teamId={teamId} />
      </Suspense>
    </div>
  );
}
