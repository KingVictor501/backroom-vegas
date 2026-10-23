/*
  FILE: lib/services/espn/mappers.ts
  WHAT IT'S FOR: Small "translator" functions that turn ESPN's shapes into OUR
  shared types from the types folder (TeamSummary, Game, NewsArticle, ...). Pages
  never see ESPN's raw format, so if we ever switch data providers, only these
  translators change.
  WHO USES IT: The other files in lib/services/espn.
  WHY THIS NAME: A "mapper" maps one shape onto another. It ends in .ts because
  it shows nothing on screen.
*/

import "server-only";
// The ESPN shapes we're translating FROM (lib/services/espn/schemas.ts).
import type { EspnArticle, EspnCompetitor, EspnEvent, EspnTeam } from "./schemas";
// toPlainText from lib/services/text.ts strips any HTML out of outside text (our XSS protection).
import { toPlainText } from "@/lib/services/text";
// The shared types we're translating TO (Section 2).
import type { Game, GameStatus, LeagueSlug, NewsArticle, TeamSummary } from "@/types";

/*
  toIsoTime: ESPN writes times like "2026-10-26T00:20Z" (no seconds). This
  turns any time ESPN sends into the standard form "2026-10-26T00:20:00.000Z",
  so times from ESPN and The Odds API can be compared exactly.
*/
export function toIsoTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

/*
  toTeamSummary: ESPN team → our TeamSummary.
  - record: passed in separately, because ESPN keeps it next to the team, not inside it.
  - logo: ESPN gives either "logo" or a "logos" list. If neither, we build the
    standard ESPN logo address from the team's short code (like "kc").
*/
export function toTeamSummary(
  team: EspnTeam,
  league: LeagueSlug,
  record: string | null = null,
): TeamSummary {
  const logoUrl =
    team.logos?.[0]?.href ??
    team.logo ??
    `https://a.espncdn.com/i/teamlogos/${league}/500/${team.abbreviation.toLowerCase()}.png`;
  return {
    id: team.id,
    abbreviation: team.abbreviation,
    location: team.location ?? "",
    name: team.name ?? team.displayName,
    displayName: team.displayName,
    logoUrl,
    record,
  };
}

/*
  overallRecord: finds a team's overall win-loss (like "5-0") in a game's
  competitor info. ESPN calls the list "records" in some answers and "record" in others.
*/
export function overallRecord(competitor: EspnCompetitor): string | null {
  const records = competitor.records ?? competitor.record ?? [];
  const overall =
    records.find((r) => r.type === "total" || r.name === "overall") ?? records[0];
  return overall?.summary ?? null;
}

/*
  competitorScore: a team's score in a game, or null if the game hasn't started
  (missing on purpose). ESPN sends "22" in some answers and { value: 22 } in others.
*/
export function competitorScore(competitor: EspnCompetitor): number | null {
  const score = competitor.score;
  if (score === undefined) return null;
  return typeof score === "object" && score !== null ? score.value : score;
}

/*
  toGameStatus: ESPN's status → our GameStatus.
  "pre" = scheduled, "in" = in progress, "post" = final, plus postponed and canceled by name.
*/
export function toGameStatus(status: EspnEvent["status"]): GameStatus {
  if (!status) return "scheduled";
  const name = status.type.name;
  if (name.includes("POSTPONED")) return "postponed";
  if (name.includes("CANCELED") || name.includes("CANCELLED")) return "canceled";
  if (status.type.state === "in") return "in-progress";
  if (status.type.state === "post" || status.type.completed) return "final";
  return "scheduled";
}

/*
  toGame: one ESPN event → our Game.
  Scores are only kept once the game has started. Before kickoff ESPN says "0",
  which would wrongly look like a 0-0 game.
*/
export function toGame(event: EspnEvent, league: LeagueSlug): Game | null {
  const competition = event.competitions[0];
  const home = competition.competitors.find((c) => c.homeAway === "home");
  const away = competition.competitors.find((c) => c.homeAway === "away");
  // A game without both teams can't be shown, so skip it instead of crashing.
  if (!home || !away) return null;

  const status = toGameStatus(competition.status ?? event.status);
  const started = status === "in-progress" || status === "final";

  return {
    id: event.id,
    league,
    startsAt: toIsoTime(event.date),
    status,
    awayTeam: toTeamSummary(away.team, league, overallRecord(away)),
    homeTeam: toTeamSummary(home.team, league, overallRecord(home)),
    awayScore: started ? competitorScore(away) : null,
    homeScore: started ? competitorScore(home) : null,
    venue: competition.venue?.fullName ?? null,
    // Filled in later by lib/services/games.ts, which matches this game to The Odds API.
    oddsEventId: null,
    // Filled in by the game summary (only the matchup page needs it).
    winProbability: null,
  };
}

/*
  toNewsArticle: one ESPN story → our NewsArticle, with all text made PLAIN
  (any HTML is stripped by toPlainText). Stories without a web link are skipped
  (null, missing on purpose), since the widget must link to ESPN.
*/
export function toNewsArticle(article: EspnArticle): NewsArticle | null {
  const url = article.links?.web?.href;
  // Only regular https web addresses. A link starting with "javascript:" (or
  // anything else) could run code when tapped, so that story is skipped.
  if (!url || !url.startsWith("https://")) return null;
  const image = article.images?.[0];
  const headline = toPlainText(article.headline);
  return {
    id: String(article.id ?? url),
    headline,
    description: toPlainText(article.description),
    imageUrl: image?.url ?? null,
    imageAlt: toPlainText(image?.alt || image?.caption || headline),
    url,
    publishedAt: toIsoTime(article.published ?? article.lastModified ?? new Date().toISOString()),
  };
}
