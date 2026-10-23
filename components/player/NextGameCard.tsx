/*
  FILE: components/player/NextGameCard.tsx
  WHAT IT'S FOR: The "Next game" card on the player page: who and when (linking
  to the matchup page), then this player's LIVE props from your sportsbook as
  gold odds buttons you can add to your slip. The conflict popup still works
  here (like anytime TD plus 2+ TDs for the same player).
  It loads its own data on the server, inside <Suspense>, so the rest of the
  page shows first and the props fill in. If your book has no props for this
  player, it says so and suggests another book in Settings.
  WHO USES IT: app/(main)/player/[playerId]/page.tsx.
  WHY THIS NAME: It's the card for the next game. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
import type { ReactNode } from "react";
// The odds button from Section 8.
import OddsButton from "@/components/betslip/OddsButton";
// The sportsbook names, from config/sportsbooks.ts.
import { SPORTSBOOKS } from "@/config/sportsbooks";
// gameLabel ("KC @ SEA") and a price → pick, from lib/betting.
import { gameLabel } from "@/lib/betting/gameLinePicks";
import { buttonText, marketPick } from "@/lib/betting/marketPicks";
// "Sunday · 4:25 PM ET", from lib/format/gameTime.ts.
import { gameDayLabel, gameTimeLabel } from "@/lib/format/gameTime";
import { UpstreamError } from "@/lib/services/http";
// The next game and the player's props in it, from lib/services/playerProps.ts.
import { getNextGameProps, type NextGameProps } from "@/lib/services/playerProps";
import type { LeagueSlug, Player, SportsbookId } from "@/types";

/* Box: the card around everything. */
function Box({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="next-game" className="rounded-2xl border border-gold/50 bg-card p-5">
      <h2 id="next-game" className="text-xl text-text">
        Next game
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* NextGameSkeleton: shown while the props load. */
export function NextGameSkeleton() {
  return (
    <Box>
      <p className="sr-only" role="status">
        Loading the next game and props…
      </p>
      <div aria-busy="true" className="space-y-2">
        <div className="h-6 w-48 animate-pulse rounded-lg bg-card-raised" />
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-12 animate-pulse rounded-lg bg-card-raised" />
        ))}
      </div>
    </Box>
  );
}

/*
  NextGameCard
  - player: whose props to show
  - nextGameId: from ESPN, or null if no game is scheduled
  - sportsbook: the user's book (from Settings)
*/
export default async function NextGameCard({
  league,
  player,
  nextGameId,
  sportsbook,
}: {
  league: LeagueSlug;
  player: Player;
  nextGameId: string | null;
  sportsbook: SportsbookId;
}) {
  const bookName = SPORTSBOOKS[sportsbook].name;
  let data: NextGameProps;
  try {
    data = await getNextGameProps(league, player, nextGameId, sportsbook);
  } catch (error) {
    if (!(error instanceof UpstreamError)) throw error;
    console.error(error.message);
    return (
      <Box>
        <p className="text-sm text-muted">Props aren&apos;t available right now. Please try again in a few minutes.</p>
      </Box>
    );
  }

  const { game, props, oddsPosted } = data;
  if (!game) {
    return (
      <Box>
        <p className="text-sm text-muted">No upcoming game is scheduled for {player.name}.</p>
      </Box>
    );
  }

  const label = gameLabel(game);
  const opponent = game.awayTeam.id === player.team?.id ? `@ ${game.homeTeam.displayName}` : `vs ${game.awayTeam.displayName}`;
  const pickGame = { gameId: game.id, league: game.league, gameLabel: label, gameStartsAt: game.startsAt };

  return (
    <Box>
      <Link href={`/matchup/${game.id}`} className="group flex items-center justify-between gap-3 rounded-xl bg-card-raised p-3">
        <span className="min-w-0">
          <span className="block truncate font-semibold text-text group-hover:text-gold">{player.team ? opponent : label}</span>
          {/* suppressHydrationWarning: "Today"/"Tomorrow" depends on the exact moment, which can differ by a second between server and browser. */}
          <span className="text-xs text-muted" suppressHydrationWarning>
            {gameDayLabel(game.startsAt)} · {gameTimeLabel(game.startsAt)}
          </span>
        </span>
        <span className="shrink-0 text-sm text-gold">Matchup ›</span>
      </Link>

      {props.length > 0 ? (
        <>
          <p className="mt-4 text-xs text-muted">
            Props from <span className="font-semibold text-text">{bookName}</span>
          </p>
          <ul className="mt-2 divide-y divide-line">
            {props.map((prop) => (
              <li key={prop.market.key} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 text-sm font-medium text-text">{prop.market.label}</span>
                <div className="flex gap-1.5">
                  {prop.outcomes.map((outcome) => {
                    const pick = marketPick(pickGame, prop.market, outcome, player.name, sportsbook);
                    return (
                      <div key={pick.id} className="w-[4.5rem]">
                        <OddsButton pick={pick} lineText={buttonText(outcome, prop.outcomes.length > 1)} />
                      </div>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="mt-4 text-sm text-muted">
          {oddsPosted
            ? `${bookName} doesn't have props for ${player.name} in this game right now. `
            : "Sportsbooks haven't posted odds for this game yet. Check back closer to game day. "}
          {oddsPosted && (
            <Link href="/settings" className="font-semibold text-gold underline-offset-4 hover:underline">
              Try another sportsbook in Settings
            </Link>
          )}
        </p>
      )}
    </Box>
  );
}
