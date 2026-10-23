/*
  FILE: components/matchup/MatchupNews.tsx
  WHAT IT'S FOR: Two parts of the matchup page, each loading on its own:
  - MatchupInjuries: "Injury report", each team's full injury report, side by
    side on wide screens. On the Game Lines tab it sits right under "Chance of
    winning"; on the other tabs it's near the bottom.
  - MatchupStories: "Matchup news", stories about THIS game (ESPN tagged them
    with the game, or with just these two teams), like previews and injury
    updates. League-wide roundups and betting stories are left out.
  Each loads its own data on the server inside <Suspense>, so the odds show
  first and these fill in after. If one can't load, it says so and the rest of
  the page still works.
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx.
  WHY THIS NAME: It's the matchup's news. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
import type { ReactNode } from "react";
// The shared injury report and news list.
import InjuryList from "@/components/InjuryList";
import NewsList from "@/components/NewsList";
// The team injury reports and the matchup's stories, from lib/services/espn.
import { getTeamInjuries } from "@/lib/services/espn/injuries";
import { getMatchupNews } from "@/lib/services/espn/news";
import type { Game, TeamSummary } from "@/types";

/* Box: the card around each part. */
function Box({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-line bg-card p-5">
      <h2 id={id} className="text-xl text-text">
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/* TeamHeading: a small logo and name over each team's injury report. */
function TeamHeading({ team }: { team: TeamSummary }) {
  return (
    <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-gold">
      {team.logoUrl && <Image src={team.logoUrl} alt="" width={20} height={20} className="size-5" />}
      {team.displayName}
    </h3>
  );
}

/* SectionSkeleton: gray bars while a part loads, under its real heading. */
export function SectionSkeleton({ title }: { title: string }) {
  return (
    <section aria-busy="true" className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-xl text-text">{title}</h2>
      <p className="sr-only" role="status">
        Loading {title.toLowerCase()}…
      </p>
      <div className="mt-3 space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-10 animate-pulse rounded-lg bg-card-raised" />
        ))}
      </div>
    </section>
  );
}

/* MatchupInjuries: both teams' injury reports. Runs on the server. */
export async function MatchupInjuries({ game }: { game: Game }) {
  const [awayInjuries, homeInjuries] = await Promise.all([
    getTeamInjuries(game.league, game.awayTeam.id).catch(() => null),
    getTeamInjuries(game.league, game.homeTeam.id).catch(() => null),
  ]);
  return (
    <Box id="matchup-injuries" title="Injury report">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {(
          [
            [game.awayTeam, awayInjuries],
            [game.homeTeam, homeInjuries],
          ] as const
        ).map(([team, injuries]) => (
          <div key={team.id} className="min-w-0">
            <TeamHeading team={team} />
            <div className="mt-1">
              {injuries === null ? (
                <p className="text-sm text-muted">Injuries aren&apos;t available right now.</p>
              ) : (
                <InjuryList injuries={injuries} />
              )}
            </div>
          </div>
        ))}
      </div>
    </Box>
  );
}

/* MatchupStories: news about this game. Runs on the server. */
export async function MatchupStories({ game }: { game: Game }) {
  const news = await getMatchupNews(game.league, game.id, game.awayTeam.id, game.homeTeam.id).catch(() => null);
  return (
    <Box id="matchup-news" title="Matchup news">
      {news === null ? (
        <p className="text-sm text-muted">News isn&apos;t available right now. Please try again in a few minutes.</p>
      ) : news.length === 0 ? (
        <p className="text-sm text-muted">No stories about this matchup yet.</p>
      ) : (
        <NewsList articles={news} />
      )}
    </Box>
  );
}
