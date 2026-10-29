/*
  FILE: lib/services/matchup.ts
  WHAT IT'S FOR: The odds for one tab of the matchup page (everything except
  Game Lines, which come free with the Feed's league-wide odds). Each tab asks
  The Odds API ONLY for its own markets, and only when you open it, to save credits:
    Player Props  → the chosen button (Touchdowns ≈ 4 credits, Receptions ≈ 1)
    Team Props    → each team's total points for the full game, Over / Under (≤ 2)
    Halves        → spread, total, and winner for each half (≤ 6)
    Quarters      → spread, total, and winner for ONE quarter (≤ 3)
    D/ST          → kicker props: field goals, kicking points, extra points (≤ 3)
    Game Specials → will the game go to overtime? (≤ 1)
  (Only markets that come back cost anything.) Results are saved for 60 minutes.
  Everything is turned into MarketSections (types/odds.ts), so every tab looks the same.
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx (and mainLineOnly is reused by lib/services/playerProps.ts).
  WHY THIS NAME: It's the service for the matchup page. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
// The market list (names, labels, parts of the game) from lib/services/odds/markets.ts.
import { describeMarket } from "@/lib/services/odds/markets";
// getEventOdds (one game's markets) and marketsForBook (one book's markets) from lib/services/odds/lines.ts.
import { getEventOdds, marketsForBook } from "@/lib/services/odds/lines";
// americanToDecimal from lib/betting/parlay.ts: used to find each row's main line (see mainLineOnly).
import { americanToDecimal } from "@/lib/betting/parlay";
// teamIdLookup: Odds API team names → ESPN team IDs (lib/services/odds/match.ts).
import { teamIdLookup } from "@/lib/services/odds/match";
// Player props and the roster-based player name matching, from lib/services/odds/props.ts.
import { getGameProps, playerLookup } from "@/lib/services/odds/props";
// The view (tab) types from lib/matchup/views.ts.
import type { MatchupView } from "@/lib/matchup/views";
// teamHref and playerHref (null for leagues without those pages), from lib/leagues/links.ts.
import { playerHref, teamHref } from "@/lib/leagues/links";
import type { GameWithLines, Market, MarketOutcome, MarketSection, MarketSectionRow, SportsbookId } from "@/types";

/*
  SectionPlan: one section on a tab.
  - keys: the Odds API markets that can fill it, best first. The first one the
    book offers is used. (Hard Rock has no regular full-game "team_totals", but
    it does have "alternate_team_totals", the same bet with more lines, so that fills in.)
  - title: the heading to show, if it should differ from the market's own label
*/
type SectionPlan = { keys: string[]; title?: string };

/*
  sectionPlansFor: which sections each tab shows, in order.
  Every market name here was seen in your Postman sample B4 for at least one of your books.
*/
function sectionPlansFor(view: Exclude<MatchupView, { kind: "game-lines" } | { kind: "player-props" }>): SectionPlan[] {
  const single = (keys: string[]) => keys.map((key) => ({ keys: [key] }));
  switch (view.kind) {
    case "team-props":
      return [{ keys: ["team_totals", "alternate_team_totals"], title: "Team Total Points" }];
    case "halves":
      return single(["spreads_h1", "totals_h1", "h2h_h1", "spreads_h2", "totals_h2", "h2h_h2"]);
    case "quarters":
      return single(["spreads", "totals", "h2h"].map((base) => `${base}_q${view.quarter}`));
    case "dst":
      return single(["player_field_goals", "player_kicking_points", "player_pats"]);
    case "specials":
      return single(["overtime"]);
  }
}

/*
  mainLineOnly: some books send MANY lines for one over/under bet (Hard Rock
  sends 15 team-total lines per team: 5.5, 6.5, ... 19.5). We keep just the
  MAIN line, the one sportsbooks headline, which is the line where the Over and
  Under prices are closest to each other (like Over 12.5 -120 / Under 12.5 -110).
  The result is always [Over, Under], so the page can show two neat columns.
  Rows that aren't over/under are left as they are.
*/
export function mainLineOnly(outcomes: MarketOutcome[]): MarketOutcome[] {
  const overs = outcomes.filter((o) => o.side === "over");
  const unders = outcomes.filter((o) => o.side === "under");
  if (overs.length === 0 || overs.length + unders.length !== outcomes.length) return outcomes;

  let best: [MarketOutcome, MarketOutcome] | null = null;
  let bestGap = Infinity;
  for (const over of overs) {
    const under = unders.find((u) => u.line === over.line);
    if (!under) continue;
    const gap = Math.abs(americanToDecimal(over.odds) - americanToDecimal(under.odds));
    if (gap < bestGap) {
      best = [over, under];
      bestGap = gap;
    }
  }
  return best ?? outcomes;
}

/*
  toSection: one market → one collapsible section, with one row per team,
  player, or the whole game. Teams show their nickname ("Chiefs"), away team first.
*/
function toSection(market: Market, game: GameWithLines, findPlayer: (name: string) => { id: string } | null): MarketSection {
  const teams = [game.awayTeam, game.homeTeam];
  const rows = new Map<string, MarketSectionRow>();

  for (const outcome of market.outcomes) {
    const { participant } = outcome;
    let key = "game";
    let label = "Game";
    let href: string | null = null;
    if (participant.kind === "team") {
      const team = teams.find((t) => t.id === participant.id);
      key = `team-${participant.id ?? participant.name}`;
      label = team?.name ?? participant.name;
      href = team ? teamHref(game.league, team.id) : null;
    } else if (participant.kind === "player") {
      const playerId = participant.id ?? findPlayer(participant.name)?.id ?? null;
      key = `player-${playerId ?? participant.name}`;
      label = participant.name;
      href = playerId ? playerHref(game.league, playerId) : null;
    }
    const row = rows.get(key) ?? { key, label, href, outcomes: [] };
    row.outcomes.push(outcome);
    rows.set(key, row);
  }

  // Keep each row's main over/under line only, then: away team first, then home; players with the best odds first.
  for (const row of rows.values()) row.outcomes = mainLineOnly(row.outcomes);
  const ordered = [...rows.values()].sort((a, b) => {
    const teamOrder = (row: MarketSectionRow) => teams.findIndex((t) => `team-${t.id}` === row.key);
    if (teamOrder(a) !== -1 || teamOrder(b) !== -1) return teamOrder(a) - teamOrder(b);
    return Math.min(...a.outcomes.map((o) => o.odds)) - Math.min(...b.outcomes.map((o) => o.odds));
  });

  return {
    title: market.label,
    market: { key: market.key, category: market.category, label: market.label, period: market.period },
    rows: ordered,
  };
}

/*
  getMatchupSections: the sections for one tab of one game, from the user's book.
  Returns [] when there are no odds (the game isn't in The Odds API, or the
  book doesn't offer these markets). The page then suggests another book.
*/
export async function getMatchupSections(
  game: GameWithLines,
  view: Exclude<MatchupView, { kind: "game-lines" }>,
  sportsbook: SportsbookId,
): Promise<MarketSection[]> {
  if (!game.oddsEventId) return [];

  if (view.kind === "player-props") {
    const props = await getGameProps(game, view.category, sportsbook);
    return props.sections.map((section) => ({
      title: section.title,
      market: {
        key: section.marketKey,
        category: "player-props",
        label: describeMarket(section.marketKey)?.fullLabel ?? section.title,
        period: section.period,
      },
      rows: section.rows.map((row) => ({
        key: `player-${row.player.id ?? row.player.name}`,
        label: row.player.name,
        href: row.player.id ? `/player/${row.player.id}` : null,
        outcomes: row.outcomes,
      })),
    }));
  }

  const plans = sectionPlansFor(view);
  const [event, findPlayer] = await Promise.all([
    getEventOdds(game.league, game.oddsEventId, plans.flatMap((plan) => plan.keys)),
    playerLookup(game),
  ]);
  if (!event) return [];

  const markets = marketsForBook(event, sportsbook, teamIdLookup(game), (name) => findPlayer(name)?.id ?? null);
  const sections: MarketSection[] = [];
  for (const plan of plans) {
    // The first market in the plan that this book offers.
    const market = plan.keys.map((key) => markets.find((m) => m.key === key)).find((m) => m !== undefined);
    if (!market) continue;
    const section = toSection(market, game, findPlayer);
    sections.push(plan.title ? { ...section, title: plan.title, market: { ...section.market, label: plan.title } } : section);
  }
  return sections;
}
