/*
  FILE: lib/leagues/links.ts
  WHAT IT'S FOR: Builds the web addresses for a game's matchup page, and for a team or player page, in a way
  that knows about different leagues:
  - The matchup address needs to say which league the game is in, because ESPN game numbers are only
    unique inside one sport: /matchup/401909881?league=nba. The NFL is the default, so its addresses stay
    exactly as they were (/matchup/401873022).
  - A team page or player page exists only for leagues with statsPages turned on (config/leagues.ts). For
    other leagues the functions answer null ("no page", missing on purpose), and the screen shows plain text.
  WHO USES IT: components/feed (cards and table), components/matchup, components/betslips/SlipDetail.tsx,
  components/InjuryList.tsx, lib/matchup/views.ts, lib/services/matchup.ts, and the matchup page.
  WHY THIS NAME: It's about links between pages. It lives in lib/leagues. It ends in .ts because it shows nothing on screen.
*/

// DEFAULT_LEAGUE_SLUG ("nfl") and getLeague from config/leagues.ts: which league needs no ?league= and which have stats pages.
import { DEFAULT_LEAGUE_SLUG, getLeague, LEAGUES } from "@/config/leagues";
import type { LeagueSlug } from "@/types";

/* matchupHref: the matchup page for a game. `query` is extra settings like "props=passing" (no leading "?"). */
export function matchupHref(gameId: string, league: string, query = ""): string {
  const parts: string[] = [];
  if (league !== DEFAULT_LEAGUE_SLUG) parts.push(`league=${encodeURIComponent(league)}`);
  if (query) parts.push(query);
  return `/matchup/${encodeURIComponent(gameId)}${parts.length ? `?${parts.join("&")}` : ""}`;
}

/* hasStatsPages: true if this league has team and player pages. */
export function hasStatsPages(league: string): boolean {
  return getLeague(league)?.statsPages === true;
}

/* teamHref: the team page, or null when this league has none (null = missing on purpose: show plain text). */
export function teamHref(league: string, teamId: string): string | null {
  return hasStatsPages(league) ? `/team/${encodeURIComponent(teamId)}` : null;
}

/* playerHref: the player page, or null when this league has none (null = missing on purpose: show plain text). */
export function playerHref(league: string, playerId: string): string | null {
  return hasStatsPages(league) ? `/player/${encodeURIComponent(playerId)}` : null;
}

/*
  parseMatchupLeague: reads the ?league= setting of a matchup address.
  - missing → the default league (NFL)
  - a league that is on AND has betting features → that league
  - anything else (a typo, a scores-only league, a trick like "../x") → null, and the page shows "not found"
  (null is missing on purpose: "that isn't a league with matchup pages".)
*/
export function parseMatchupLeague(value: string | string[] | undefined): LeagueSlug | null {
  const text = (Array.isArray(value) ? value[0] : value) ?? "";
  if (text === "") return DEFAULT_LEAGUE_SLUG as LeagueSlug;
  const league = LEAGUES.find((candidate) => candidate.slug === text);
  return league && league.enabled && league.bettingEnabled ? (league.slug as LeagueSlug) : null;
}

/* hasMoreMarkets: true if this league has market tabs beyond Game Lines (player props, halves, quarters...). */
export function hasMoreMarkets(league: string): boolean {
  return (getLeague(league)?.betTypes.length ?? 1) > 1;
}
