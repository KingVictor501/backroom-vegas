/*
  FILE: lib/services/espn/news.ts
  WHAT IT'S FOR: Gets NFL news from ESPN, for the whole league or for one team,
  as our NewsArticle type, with all text turned into plain text first (no HTML).
  WHO USES IT: Later: the news API route and widget (Sections 6 and 14) and the team page (Section 11).
  WHY THIS NAME: It's the ESPN code for news. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cached, CACHE_SECONDS } from "@/lib/services/cache";
import { espnGet, espnUrl, requireLeague } from "./client";
import { newsSchema } from "./schemas";
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
