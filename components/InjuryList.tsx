/*
  FILE: components/InjuryList.tsx
  WHAT IT'S FOR: A team's injury report: each player's name (linking to their
  player page), position, what's wrong, and their status ("Out",
  "Questionable", ...) in a red badge. Shows "No injuries reported." when empty.
  WHO USES IT: the team page (components/team/TeamSections.tsx) and the
  matchup page (components/matchup/MatchupNews.tsx).
  WHY THIS NAME: It lists injuries. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
import type { Injury } from "@/types";

/* InjuryList */
export default function InjuryList({ injuries }: { injuries: Injury[] }) {
  if (injuries.length === 0) return <p className="text-sm text-muted">No injuries reported.</p>;
  return (
    <ul className="divide-y divide-line">
      {injuries.map((injury) => (
        <li key={injury.player.id} className="flex items-start justify-between gap-3 py-2.5">
          <div className="min-w-0">
            <Link href={`/player/${injury.player.id}`} className="block truncate text-sm font-medium text-text hover:text-gold">
              {injury.player.name}
            </Link>
            <p className="text-xs text-muted">{[injury.player.position, injury.detail].filter(Boolean).join(" · ")}</p>
          </div>
          <span className="shrink-0 rounded-full border border-danger/50 px-2.5 py-0.5 text-xs font-medium text-danger">{injury.status}</span>
        </li>
      ))}
    </ul>
  );
}
