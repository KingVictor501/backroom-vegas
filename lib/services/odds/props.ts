/*
  FILE: lib/services/odds/props.ts
  WHAT IT'S FOR: Player props for ONE game and ONE category (Touchdowns,
  Passing, Rushing, Receiving, Receptions), arranged into the collapsible
  sections from the spec (TD Scorers, First TD Scorer, 2+ TDs, 1st Half TDs, ...).
  Props are only loaded for the game the user is looking at, to save credits.
  Player names from The Odds API are matched to ESPN players (by name, since
  the APIs share no IDs), so names can link to player pages.
  WHO USES IT: Later: the matchup page's Player Props tab (Section 10) and the player page (Section 11B).
  WHY THIS NAME: It's about props. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { normalizeName } from "@/lib/services/text";
import { getTeamRoster } from "@/lib/services/espn/teams";
import { getEventOdds, marketsForBook } from "./lines";
import { teamIdLookup } from "./match";
import type {
  Game,
  GameProps,
  PlayerPropRow,
  PlayerSummary,
  PropCategory,
  PropSection,
  SportsbookId,
} from "@/types";

/*
  SectionPlan: one collapsible section.
  - marketKey: which Odds API market fills it
  - title: the section heading
  - onlyLine: for "2+ TDs", keep only the 1.5 line (Over 1.5 touchdowns = 2 or more)
*/
type SectionPlan = { marketKey: string; title: string; onlyLine?: number };

/*
  PROP_SECTIONS: which sections each prop button shows, in order. The first
  section starts open on the page. Costs 1 credit per market that returns
  odds, so Touchdowns is about 4 credits and Receptions about 1.
*/
export const PROP_SECTIONS: Record<PropCategory, SectionPlan[]> = {
  touchdowns: [
    { marketKey: "player_anytime_td", title: "TD Scorers" },
    { marketKey: "player_1st_td", title: "First TD Scorer" },
    { marketKey: "player_tds_over", title: "2+ TDs", onlyLine: 1.5 },
    { marketKey: "player_anytime_td_h1", title: "1st Half TDs" },
  ],
  passing: [
    { marketKey: "player_pass_yds", title: "Passing Yards" },
    { marketKey: "player_pass_tds", title: "Passing TDs" },
    { marketKey: "player_pass_completions", title: "Completions" },
    { marketKey: "player_pass_attempts", title: "Pass Attempts" },
    { marketKey: "player_pass_interceptions", title: "Interceptions Thrown" },
  ],
  rushing: [
    { marketKey: "player_rush_yds", title: "Rushing Yards" },
    { marketKey: "player_rush_attempts", title: "Rush Attempts" },
    { marketKey: "player_rush_longest", title: "Longest Rush" },
  ],
  receiving: [
    { marketKey: "player_reception_yds", title: "Receiving Yards" },
    { marketKey: "player_reception_longest", title: "Longest Reception" },
  ],
  receptions: [{ marketKey: "player_receptions", title: "Receptions" }],
};

/*
  playerLookup: builds a name → ESPN player lookup from BOTH teams' rosters.
  "Patrick Mahomes" (Odds API) → { id: "3139477", name: "Patrick Mahomes", ... } (ESPN).
*/
async function playerLookup(game: Game): Promise<(name: string) => PlayerSummary | null> {
  const [home, away] = await Promise.all([
    getTeamRoster(game.league, game.homeTeam.id),
    getTeamRoster(game.league, game.awayTeam.id),
  ]);
  const byName = new Map<string, PlayerSummary>();
  for (const player of [...home, ...away]) {
    byName.set(normalizeName(player.name), {
      id: player.id,
      name: player.name,
      position: player.position,
      teamAbbreviation: player.teamAbbreviation,
    });
  }
  return (name) => byName.get(normalizeName(name)) ?? null;
}

/*
  getGameProps: one prop category for one game, from the user's sportsbook.
  - game: the ESPN game, with oddsEventId already matched (see lib/services/games.ts)
  - sportsbook: the user's chosen book
  Returns sections = [] when the game has no odds yet or the book doesn't offer
  these props. The page then suggests trying another book in Settings.
*/
export async function getGameProps(
  game: Game,
  category: PropCategory,
  sportsbook: SportsbookId,
): Promise<GameProps> {
  const empty: GameProps = { gameId: game.id, category, sportsbook, sections: [] };
  if (!game.oddsEventId) return empty;

  const plans = PROP_SECTIONS[category];
  const [event, findPlayer] = await Promise.all([
    getEventOdds(game.league, game.oddsEventId, plans.map((plan) => plan.marketKey)),
    playerLookup(game),
  ]);
  if (!event) return empty;

  const markets = marketsForBook(
    event,
    sportsbook,
    teamIdLookup(game),
    (name) => findPlayer(name)?.id ?? null,
  );

  const sections: PropSection[] = [];
  for (const plan of plans) {
    const market = markets.find((m) => m.key === plan.marketKey);
    if (!market) continue;

    // Group the outcomes by player, so each row is one player with their odds buttons.
    const rows = new Map<string, PlayerPropRow>();
    for (const outcome of market.outcomes) {
      if (plan.onlyLine !== undefined && outcome.line !== plan.onlyLine) continue;
      const name = outcome.participant.name;
      const row = rows.get(name) ?? { player: findPlayer(name) ?? { id: null, name }, outcomes: [] };
      row.outcomes.push(outcome);
      rows.set(name, row);
    }
    if (rows.size === 0) continue;

    sections.push({
      marketKey: plan.marketKey,
      title: plan.title,
      period: market.period,
      // Best odds (most likely to happen) first, like real sportsbooks list them.
      rows: [...rows.values()].sort(
        (a, b) => Math.min(...a.outcomes.map((o) => o.odds)) - Math.min(...b.outcomes.map((o) => o.odds)),
      ),
    });
  }
  return { ...empty, sections };
}
