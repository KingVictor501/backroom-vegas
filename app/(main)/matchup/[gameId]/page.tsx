/*
  FILE: app/(main)/matchup/[gameId]/page.tsx
  WHAT IT'S FOR: One game's matchup page, e.g. /matchup/401873022. Built on
  the server, as described in PAGES:
  - the header: both logos (linking to the team pages), names, records, date and time
  - the Odds / Insights pill (Insights grayed out), and Build your own SGP
  - the row of market links, then the chosen view:
    Game Lines (spread, total, winner + each team's chance of winning), or
    Player Props / Team Props / Halves / Quarters / D/ST / Game Specials as
    collapsible sections (the first one open)
  If your sportsbook doesn't offer a market, it says so and suggests trying
  another book in Settings. A fake game ID shows "not found".
  WHO USES IT: Next.js shows it for any address that starts with /matchup/.
  Game cards on the Feed and league page link here.
  WHY THIS NAME: "[gameId]" in square brackets is a dynamic folder: the ID in the
  address is handed to the page as "gameId". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
// The odds table from the Feed (components/feed), reused here so both look the same.
import GameLinesTable from "@/components/feed/GameLinesTable";
// The matchup page pieces, from components/matchup.
import MarketSections from "@/components/matchup/MarketSections";
import MatchupHeader from "@/components/matchup/MatchupHeader";
import MatchupTabs from "@/components/matchup/MatchupTabs";
import WinProbability from "@/components/matchup/WinProbability";
// The league (only NFL for now) and the sportsbook names, from the config folder.
import { DEFAULT_LEAGUE_SLUG } from "@/config/leagues";
import { SPORTSBOOKS } from "@/config/sportsbooks";
// requireUser from lib/auth/dal.ts: the logged-in user (for their sportsbook).
import { requireUser } from "@/lib/auth/dal";
// gameLabel ("KC @ SEA") from lib/betting/gameLinePicks.ts.
import { gameLabel } from "@/lib/betting/gameLinePicks";
// The views (tabs) and their addresses, from lib/matchup/views.ts.
import { parseView, viewName } from "@/lib/matchup/views";
// The data: one game with its odds (lib/services/games.ts) and one tab's markets (lib/services/matchup.ts).
import { getGameWithLines } from "@/lib/services/games";
import { getMatchupSections } from "@/lib/services/matchup";
import { getGameSummary } from "@/lib/services/espn/games";
import { UpstreamError } from "@/lib/services/http";
import type { LeagueSlug, MarketSection } from "@/types";

/*
  LEAGUE: matchup addresses don't include the league yet, because only the NFL
  is on. When another league is turned on, the address can become /matchup/<league>/<id>.
*/
const LEAGUE = DEFAULT_LEAGUE_SLUG as LeagueSlug;

/* isGameId: ESPN game IDs are only digits. Anything else can't be a real game. */
function isGameId(id: string): boolean {
  return /^\d{1,12}$/.test(id);
}

/* generateMetadata: the browser tab title, like "KC @ SEA | The Vegas Backroom". */
export async function generateMetadata(props: PageProps<"/matchup/[gameId]">): Promise<Metadata> {
  const { gameId } = await props.params;
  const summary = isGameId(gameId) ? await getGameSummary(LEAGUE, gameId).catch(() => null) : null;
  return { title: summary ? gameLabel(summary.game) : "Matchup" };
}

/* NoOdds: the friendly note when the user's book doesn't offer this market. */
function NoOdds({ bookName, what }: { bookName: string; what: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-6 text-center">
      <p className="text-sm text-text">
        {bookName} doesn&apos;t offer {what} for this game right now.
      </p>
      <p className="mt-2 text-sm text-muted">
        Other books might.{" "}
        <Link href="/settings" className="font-semibold text-gold underline-offset-4 hover:underline">
          Try another sportsbook in Settings
        </Link>
        .
      </p>
    </div>
  );
}

/* MatchupPage: runs on the server. */
export default async function MatchupPage(props: PageProps<"/matchup/[gameId]">) {
  const { gameId } = await props.params;
  if (!isGameId(gameId)) notFound();

  const [user, search] = await Promise.all([requireUser(), props.searchParams]);
  const data = await getGameWithLines(LEAGUE, gameId, user.preferredSportsbook);
  if (!data) notFound();

  const { game } = data;
  const view = parseView(search);
  const bookName = SPORTSBOOKS[user.preferredSportsbook].name;
  const label = gameLabel(game);

  // Load the chosen tab's markets (Game Lines are already loaded). An Odds API
  // failure shows a message in place of the odds, while the rest of the page still works.
  let sections: MarketSection[] = [];
  let oddsFailed = data.oddsUnavailable;
  if (view.kind !== "game-lines") {
    try {
      sections = await getMatchupSections(game, view, user.preferredSportsbook);
    } catch (error) {
      if (!(error instanceof UpstreamError)) throw error;
      console.error(error.message);
      oddsFailed = true;
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <MatchupHeader game={game} />
      <MatchupTabs gameId={game.id} gameLabel={label} view={view} />

      <p className="text-xs text-muted">
        Odds from <span className="font-semibold text-text">{bookName}</span> ·{" "}
        <Link href="/settings" className="text-gold underline-offset-4 hover:underline">
          Change
        </Link>
      </p>

      {oddsFailed ? (
        <p role="status" className="rounded-2xl border border-danger/50 bg-card p-6 text-sm text-danger">
          Odds aren&apos;t available right now. Please try again in a few minutes.
        </p>
      ) : view.kind === "game-lines" ? (
        <>
          {game.lines ? (
            <section aria-label="Game lines" className="rounded-2xl border border-line bg-card p-4">
              <GameLinesTable game={game} sportsbook={user.preferredSportsbook} />
            </section>
          ) : (
            <NoOdds bookName={bookName} what="game lines" />
          )}
          <WinProbability game={game} />
        </>
      ) : sections.length > 0 ? (
        <MarketSections
          sections={sections}
          game={{ gameId: game.id, league: game.league, gameLabel: label, gameStartsAt: game.startsAt }}
          sportsbook={user.preferredSportsbook}
        />
      ) : (
        <NoOdds bookName={bookName} what={viewName(view)} />
      )}
    </div>
  );
}
