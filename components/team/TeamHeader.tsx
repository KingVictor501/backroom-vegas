/*
  FILE: components/team/TeamHeader.tsx
  WHAT IT'S FOR: The top of the team page, which loads FIRST: the logo, name,
  record, and division standing, then a grid of season stats (points scored
  and allowed, yards, passing, rushing, turnovers, home and away record).
  Missing stats show a dash.
  WHO USES IT: app/(main)/team/[teamId]/page.tsx.
  WHY THIS NAME: It's the team page's header. It ends in .tsx because it shows something on screen.
*/

import Image from "next/image";
// TeamOverview: the team's name, logo, record, standing, and season stats (lib/services/espn/teams.ts).
import type { TeamOverview } from "@/lib/services/espn/teams";

/* show: a number for the stat grid, with commas and up to 1 decimal, or a dash if missing. */
function show(value: number | string | null): string {
  if (value === null) return "–";
  if (typeof value === "string") return value;
  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/* TeamHeader */
export default function TeamHeader({ overview }: { overview: TeamOverview }) {
  const { team, divisionStanding, seasonStats } = overview;
  const stats: { label: string; value: number | string | null }[] = [
    { label: "Points scored", value: seasonStats.pointsFor },
    { label: "Points allowed", value: seasonStats.pointsAgainst },
    { label: "Yards per game", value: seasonStats.totalYardsPerGame },
    { label: "Passing yds / game", value: seasonStats.passingYardsPerGame },
    { label: "Rushing yds / game", value: seasonStats.rushingYardsPerGame },
    { label: "Turnovers", value: seasonStats.turnovers },
    { label: "Home record", value: seasonStats.homeRecord },
    { label: "Away record", value: seasonStats.awayRecord },
  ];

  return (
    <>
      <header className="flex items-center gap-4 rounded-2xl border border-line bg-card p-5">
        {team.logoUrl ? (
          <Image src={team.logoUrl} alt="" width={96} height={96} className="size-20 shrink-0 sm:size-24" priority />
        ) : (
          <span aria-hidden className="size-20 shrink-0 rounded-full bg-card-raised" />
        )}
        <div className="min-w-0">
          <h1 className="text-3xl leading-tight text-gold">{team.displayName}</h1>
          <p className="mt-1 text-lg font-semibold tabular-nums text-text">{team.record ?? "Record unavailable"}</p>
          {divisionStanding && <p className="text-sm text-muted">{divisionStanding}</p>}
        </div>
      </header>

      <section aria-labelledby="season-stats" className="rounded-2xl border border-line bg-card p-5">
        <h2 id="season-stats" className="text-xl text-text">
          Season stats
        </h2>
        {/* dl = a list of label/value pairs, so screen readers read "Points scored: 148". */}
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-card-raised p-3">
              <dt className="text-xs text-muted">{stat.label}</dt>
              <dd className="mt-1 text-xl font-semibold tabular-nums text-text">{show(stat.value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}
