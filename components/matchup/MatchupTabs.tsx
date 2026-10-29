/*
  FILE: components/matchup/MatchupTabs.tsx
  WHAT IT'S FOR: The controls under the matchup header, as described in PAGES:
  1. One pill-shaped container with two buttons: Odds and Insights. Insights is
     grayed out ("Coming soon") because AI isn't added yet.
  2. The gold-outlined Build your own SGP button.
  3. The row of market links: Game Lines, Player Props, Team Props, Halves,
     Quarters, D/ST, Game Specials. It scrolls sideways on small screens.
  4. Inside Player Props: Touchdowns, Passing, Rushing, Receiving, Receptions.
     Inside Quarters: 1st, 2nd, 3rd, 4th.
  Every tab is a real link (the view is in the address), so they work with
  JavaScript off and the browser's Back button goes to the last tab.
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx.
  WHY THIS NAME: The matchup page's tabs. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
// The Build your own SGP button from Section 8 (components/betslip).
import StartSgpButton from "@/components/betslip/StartSgpButton";
// The list of views and their addresses, from lib/matchup/views.ts.
// hasMoreMarkets (lib/leagues/links.ts): does this league have tabs beyond Game Lines?
import { hasMoreMarkets } from "@/lib/leagues/links";
import { MARKET_LINKS, PLAYER_PROP_BUTTONS, QUARTERS, viewHref, type MatchupView } from "@/lib/matchup/views";

/* chip: the small outlined button look, gold when it's the one showing. */
function chip(active: boolean): string {
  return `inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-medium transition-colors ${
    active ? "border-gold bg-gold/10 text-gold" : "border-line text-muted hover:border-muted hover:text-text"
  }`;
}

/*
  MatchupTabs
  - gameId / gameLabel: the game (for links and the SGP button, like "KC @ SEA")
  - view: which tab is showing
*/
export default function MatchupTabs({ gameId, gameLabel, view, league }: { gameId: string; gameLabel: string; view: MatchupView; league: string }) {
  // Leagues with only Game Lines (the NBA for now) skip the row of other market tabs.
  const moreMarkets = hasMoreMarkets(league);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* The pill: Odds (always on, since it's the only working view) and Insights (coming soon). */}
        <div className="flex rounded-full border border-line bg-card p-1">
          <Link href={viewHref(gameId, { kind: "game-lines" }, league)} aria-current="page" className="min-h-10 rounded-full bg-gold px-5 py-2 text-sm font-semibold text-bg">
            Odds
          </Link>
          <span
            title="Coming soon"
            aria-disabled="true"
            className="min-h-10 cursor-not-allowed rounded-full px-5 py-2 text-sm font-semibold text-disabled"
          >
            Insights<span className="sr-only">, coming soon</span>
          </span>
        </div>
        <StartSgpButton gameId={gameId} gameLabel={gameLabel} look="button" />
      </div>

      {moreMarkets && (
      <nav aria-label="Markets" className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max min-w-full flex-nowrap gap-2 pb-1">
          {MARKET_LINKS.map((link) => {
            const active = link.view.kind === view.kind;
            return (
              <li key={link.label} className="shrink-0">
                <Link href={viewHref(gameId, link.view, league)} aria-current={active ? "page" : undefined} className={chip(active)}>
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      )}

      {view.kind === "player-props" && (
        <nav aria-label="Player prop types" className="scroll-row -mx-4 px-4 sm:mx-0 sm:px-0">
          <ul className="flex w-max flex-nowrap gap-2 pb-1">
            {PLAYER_PROP_BUTTONS.map((button) => {
              const active = button.category === view.category;
              return (
                <li key={button.category} className="shrink-0">
                  <Link
                    href={viewHref(gameId, { kind: "player-props", category: button.category }, league)}
                    aria-current={active ? "page" : undefined}
                    className={chip(active)}
                  >
                    {button.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {view.kind === "quarters" && (
        <nav aria-label="Quarters" className="flex gap-2">
          {QUARTERS.map((quarter) => {
            const active = quarter === view.quarter;
            return (
              <Link
                key={quarter}
                href={viewHref(gameId, { kind: "quarters", quarter }, league)}
                aria-current={active ? "page" : undefined}
                className={chip(active)}
              >
                {["1st", "2nd", "3rd", "4th"][quarter - 1]}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
