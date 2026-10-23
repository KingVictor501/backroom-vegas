/*
  FILE: components/matchup/MarketSections.tsx
  WHAT IT'S FOR: The collapsible sections on the matchup page, like "TD
  Scorers", "First TD Scorer", or "Spread (1st Half)". Names are on the left
  (player names link to their player pages) and odds buttons on the right.
  The FIRST section starts open; tap a heading to open or close any section.
  It uses the browser's built-in <details> box, so opening and closing works
  with a keyboard (Tab to a heading, then Enter or Space) and even with
  JavaScript off.
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx.
  WHY THIS NAME: Sections of markets. It ends in .tsx because it shows something on screen.
*/

import Link from "next/link";
// The odds button from Section 8.
import OddsButton from "@/components/betslip/OddsButton";
// marketPick and buttonText from lib/betting/marketPicks.ts: a price → a bet slip pick, and its button words.
import { buttonText, marketPick, type PickGame } from "@/lib/betting/marketPicks";
import type { MarketSection, SportsbookId } from "@/types";

/*
  isOverUnder: true when every row is exactly [Over, Under] (the server puts
  them in that order), so the section can show "Over" and "Under" column headings.
*/
function isOverUnder(section: MarketSection): boolean {
  return section.rows.every(
    (row) => row.outcomes.length === 2 && row.outcomes[0].side === "over" && row.outcomes[1].side === "under",
  );
}

/*
  MarketSections
  - sections: what to show (from lib/services/matchup.ts)
  - game: the game details every pick saves
  - sportsbook: the book the prices came from
*/
export default function MarketSections({
  sections,
  game,
  sportsbook,
}: {
  sections: MarketSection[];
  game: PickGame;
  sportsbook: SportsbookId;
}) {
  return (
    <div className="space-y-3">
      {sections.map((section, index) => (
        <details key={section.market.key} open={index === 0} className="group rounded-2xl border border-line bg-card">
          {/* summary: the heading you tap. The arrow turns when the section is open. */}
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-lg text-text">{section.title}</span>
            <svg aria-hidden viewBox="0 0 20 20" className="size-4 shrink-0 text-muted transition-transform group-open:rotate-180" fill="currentColor">
              <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
            </svg>
          </summary>

          {/* Over/Under sections (like team totals) get two labeled columns. */}
          {isOverUnder(section) && (
            <div aria-hidden className="flex items-center gap-3 border-t border-line px-4 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              <span className="flex-1" />
              {/* Same widths and gap as the buttons below, so each heading sits right above its column. */}
              <span className="flex gap-1.5">
                <span className="w-[4.5rem] text-center">Over</span>
                <span className="w-[4.5rem] text-center">Under</span>
              </span>
            </div>
          )}
          <ul className={`divide-y divide-line ${isOverUnder(section) ? "" : "border-t border-line"}`}>
            {section.rows.map((row) => {
              const hasChoices = row.outcomes.length > 1;
              return (
                <li key={row.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    {row.href ? (
                      <Link href={row.href} className="block truncate text-sm font-medium text-text hover:text-gold">
                        {row.label}
                      </Link>
                    ) : (
                      <span className="block truncate text-sm font-medium text-text">{row.label}</span>
                    )}
                  </div>
                  {/* Up to 2 prices sit side by side; longer lists (like alternate lines) wrap onto more lines. */}
                  <div className="flex max-w-[60%] flex-wrap justify-end gap-1.5">
                    {row.outcomes.map((outcome) => {
                      const pick = marketPick(game, section.market, outcome, row.label, sportsbook);
                      return (
                        <div key={pick.id} className="w-[4.5rem]">
                          <OddsButton pick={pick} lineText={buttonText(outcome, hasChoices)} />
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      ))}
    </div>
  );
}
