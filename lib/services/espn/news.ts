/*
  FILE: lib/services/espn/news.ts
  WHAT IT'S FOR: Gets NFL news from ESPN, for the whole league, for one team,
  or about one matchup, as our NewsArticle type, with all text turned into
  plain text first (no HTML).
  WHO USES IT: the news API route and Feed widget, the team page, and the matchup page.
  WHY THIS NAME: It's the ESPN code for news. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { espnGet, espnUrl, requireLeague } from "./client";
import { newsSchema, type EspnArticle } from "./schemas";
import { toNewsArticle } from "./mappers";
import type { LeagueSlug, NewsArticle } from "@/types";

/*
  getNews: the latest stories, newest first.
  - teamId: optional ESPN team ID, for one team's news (like "12" for the Chiefs).
  - limit: how many stories (ESPN's default is about 6).
  Saved for 15 minutes.
*/
export const getNews = cached(
  "espn-news",
  CACHE_SECONDS.espnNews,
  async (leagueSlug: LeagueSlug, teamId: string | null = null, limit: number = 10): Promise<NewsArticle[]> => {
    const league = requireLeague(leagueSlug);
    const query = new URLSearchParams({ limit: String(limit) });
    if (teamId) query.set("team", teamId);
    const data = await espnGet(espnUrl("site", league, `news?${query}`), newsSchema, "news");
    return data.articles
      .map(toNewsArticle)
      .filter((article): article is NewsArticle => article !== null)
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  },
);

/*
  aboutMatchup: true if a story is about THIS game, not a league-wide roundup:
  - ESPN tagged it with this game (eventId), or
  - it's tagged with both teams and NO other team (like "NFL to increase
    security in Paris for Steelers-Saints game")
  Stories tagged as sports betting are left out (no odds from ESPN, by your rule).
*/
function aboutMatchup(article: EspnArticle, gameId: string, teamIds: [string, string]): boolean {
  const categories = article.categories ?? [];
  if (categories.some((c) => /betting/i.test(c.description ?? ""))) return false;
  if (categories.some((c) => c.type === "event" && String(c.eventId) === gameId)) return true;
  const teams = new Set(categories.filter((c) => c.type === "team").map((c) => String(c.teamId)));
  return teams.size === 2 && teams.has(teamIds[0]) && teams.has(teamIds[1]);
}

/*
  getMatchupNews: stories about one game: those ESPN tagged with the game, or
  with just its two teams (previews, injury news, game stories). Stories tagged
  with the game come first, then newest first. Reads each team's latest 50
  stories (2 ESPN requests) and keeps the ones that match.
  Saved for 15 minutes, like other news.
*/
export const getMatchupNews = cached(
  "espn-matchup-news",
  CACHE_SECONDS.espnNews,
  async (leagueSlug: LeagueSlug, gameId: string, awayTeamId: string, homeTeamId: string, limit: number = 6): Promise<NewsArticle[]> => {
    const league = requireLeague(leagueSlug);
    const feeds = await Promise.all(
      [awayTeamId, homeTeamId].map((team) =>
        espnGet(espnUrl("site", league, `news?${new URLSearchParams({ team, limit: "50" })}`), newsSchema, "team news"),
      ),
    );
    const seen = new Set<string>();
    const matches: { article: NewsArticle; taggedWithGame: boolean }[] = [];
    for (const raw of feeds.flatMap((feed) => feed.articles)) {
      if (!aboutMatchup(raw, gameId, [awayTeamId, homeTeamId])) continue;
      const article = toNewsArticle(raw);
      if (!article || seen.has(article.id)) continue;
      seen.add(article.id);
      const taggedWithGame = (raw.categories ?? []).some((c) => c.type === "event" && String(c.eventId) === gameId);
      matches.push({ article, taggedWithGame });
    }
    return matches
      .sort((a, b) => Number(b.taggedWithGame) - Number(a.taggedWithGame) || b.article.publishedAt.localeCompare(a.article.publishedAt))
      .slice(0, limit)
      .map((match) => match.article);
  },
);
