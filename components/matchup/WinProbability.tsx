/*
  FILE: components/matchup/WinProbability.tsx
  WHAT IT'S FOR: Each team's chance of winning, as a split bar with the
  percentages, like "KC 62% | SEA 38%". The numbers come from ESPN's game
  predictor (a stat model, NOT betting odds). If ESPN doesn't have them, the
  page simply doesn't show this.
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx (the Game Lines view).
  WHY THIS NAME: It shows win probability. It ends in .tsx because it shows something on screen.
*/

import type { Game } from "@/types";

/* WinProbability: only drawn when the game has win chances. */
export default function WinProbability({ game }: { game: Game }) {
  if (!game.winProbability) return null;
  const away = Math.round(game.winProbability.away);
  const home = Math.round(game.winProbability.home);

  return (
    <section aria-labelledby="win-chance" className="rounded-2xl border border-line bg-card p-4">
      <h2 id="win-chance" className="font-display text-lg text-text">
        Chance of winning
      </h2>
      <div className="mt-3 flex justify-between text-sm font-semibold tabular-nums">
        <span className="text-gold">
          {game.awayTeam.abbreviation} {away}%
        </span>
        <span className="text-text">
          {home}% {game.homeTeam.abbreviation}
        </span>
      </div>
      {/* The bar is only a picture of the same numbers, so screen readers skip it. */}
      <div aria-hidden className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-card-raised">
        <div className="bg-gold" style={{ width: `${away}%` }} />
        <div className="flex-1 bg-muted/40" />
      </div>
      <p className="mt-2 text-xs text-muted">From ESPN&apos;s game predictor, not the sportsbook.</p>
    </section>
  );
}
