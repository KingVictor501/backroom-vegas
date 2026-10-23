/*
  FILE: lib/services/playerProps.ts
  WHAT IT'S FOR: The player page's "next game" card: the player's next game
  and their LIVE props in it (from The Odds API, from the user's sportsbook).
  It only runs when someone opens a player page, and only asks for the props
  that fit the player's position, to save credits:
    QB    → passing yards, passing TDs, completions, attempts, interceptions, rushing yards, anytime TD (≤ 7)
    RB    → rushing yards, rush attempts, receptions, receiving yards, anytime TD (≤ 5)
    WR/TE → receiving yards, receptions, longest reception, anytime TD (≤ 4)
    other → kicking props: field goals, kicking points, extra points (≤ 3)
  The answer is saved for 60 minutes per game and position, so every QB in the
  same game shares one request.
  WHO USES IT: app/(main)/player/[playerId]/page.tsx.
  WHY THIS NAME: It's the props for one player. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
// One game with its odds (lib/services/games.ts).
import { getGameWithLines } from "@/lib/services/games";
// mainLineOnly from lib/services/matchup.ts: keeps one Over/Under line per bet.
import { mainLineOnly } from "@/lib/services/matchup";
// Odds API helpers: one game's markets, one book's markets, team and player name matching.
import { getEventOdds, marketsForBook } from "@/lib/services/odds/lines";
import { teamIdLookup } from "@/lib/services/odds/match";
import { playerLookup } from "@/lib/services/odds/props";
import { normalizeName } from "@/lib/services/text";
import type { GameWithLines, LeagueSlug, MarketOutcome, MarketSection, Player, SportsbookId } from "@/types";

/* PROP_MARKETS: which markets to ask for, by the player's position group. */
const PROP_MARKETS: Record<Player["positionGroup"], string[]> = {
  QB: [
    "player_pass_yds",
    "player_pass_tds",
    "player_pass_completions",
    "player_pass_attempts",
    "player_pass_interceptions",
    "player_rush_yds",
    "player_anytime_td",
  ],
  RB: ["player_rush_yds", "player_rush_attempts", "player_receptions", "player_reception_yds", "player_anytime_td"],
  "WR-TE": ["player_reception_yds", "player_receptions", "player_reception_longest", "player_anytime_td"],
  OTHER: ["player_field_goals", "player_kicking_points", "player_pats"],
};

/*
  PlayerPropLine: one prop for this player, like "Passing Yards  O 249.5 / U 249.5".
  market: so each odds button can become a bet slip pick.
*/
export type PlayerPropLine = { market: MarketSection["market"]; outcomes: MarketOutcome[] };

/*
  NextGameProps: what the next-game card shows.
  - game: the next game, or null if none is scheduled (missing on purpose)
  - props: this player's props in it ([] if the book has none for them)
  - oddsPosted: false when the game isn't in The Odds API yet (lines open later in the week)
*/
export type NextGameProps = { game: GameWithLines | null; props: PlayerPropLine[]; oddsPosted: boolean };

/*
  getNextGameProps: the player's next game and their props in it, from one sportsbook.
  - nextGameId: from ESPN (the player page already has it), or null
*/
export async function getNextGameProps(
  league: LeagueSlug,
  player: Player,
  nextGameId: string | null,
  sportsbook: SportsbookId,
): Promise<NextGameProps> {
  if (!nextGameId) return { game: null, props: [], oddsPosted: false };
  const data = await getGameWithLines(league, nextGameId, sportsbook);
  if (!data) return { game: null, props: [], oddsPosted: false };
  const { game } = data;
  if (!game.oddsEventId) return { game, props: [], oddsPosted: false };

  const keys = PROP_MARKETS[player.positionGroup];
  const [event, findPlayer] = await Promise.all([getEventOdds(league, game.oddsEventId, keys), playerLookup(game)]);
  if (!event) return { game, props: [], oddsPosted: false };

  // The Odds API only knows names, so match by ESPN ID (from the roster) or, failing that, by name.
  const isThisPlayer = (outcome: MarketOutcome) =>
    outcome.participant.id === player.id || normalizeName(outcome.participant.name) === normalizeName(player.name);

  const markets = marketsForBook(event, sportsbook, teamIdLookup(game), (name) => findPlayer(name)?.id ?? null);
  const props: PlayerPropLine[] = [];
  for (const key of keys) {
    const market = markets.find((m) => m.key === key);
    const outcomes = mainLineOnly(market?.outcomes.filter(isThisPlayer) ?? []);
    if (!market || outcomes.length === 0) continue;
    props.push({
      market: { key: market.key, category: market.category, label: market.label, period: market.period },
      outcomes,
    });
  }
  return { game, props, oddsPosted: true };
}
