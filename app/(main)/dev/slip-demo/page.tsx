/*
  FILE: app/(main)/dev/slip-demo/page.tsx
  WHAT IT'S FOR: A TEMPORARY practice page for Section 8, so you can try the
  odds buttons, the slip bar, the conflict popup, and Build your own SGP before
  the real Feed exists. The prices are SAMPLES typed in here, not live odds.
  Saving is real: picks go to your actual slips in MongoDB.
  It only works while coding on your computer. On the live site it shows
  "not found". DELETE THIS FILE in Section 9, once the Feed has real odds buttons.
  WHO USES IT: You, at http://localhost:3000/dev/slip-demo
  WHY THIS NAME: "dev" = for development only. It ends in .tsx because it shows
  something on screen.
*/

import type { Metadata } from "next";
import { notFound } from "next/navigation";
// The real odds button and SGP button from components/betslip (the same ones the Feed will use).
import OddsButton from "@/components/betslip/OddsButton";
import StartSgpButton from "@/components/betslip/StartSgpButton";
// makePickId from lib/betting/picks.ts: gives each sample pick its ID.
import { makePickId } from "@/lib/betting/picks";
import type { NewBetPick } from "@/types";

export const metadata: Metadata = { title: "Slip practice" };

/* The two sample games. IDs are the real ESPN ones. */
const KC_SEA = { gameId: "401873022", gameLabel: "KC @ SEA", gameStartsAt: "2026-10-26T00:20Z" };
const LAC_KC = { gameId: "401873006", gameLabel: "LAC @ KC", gameStartsAt: "2026-10-18T20:25Z" };
const chiefs = { kind: "team", id: "12", name: "Kansas City Chiefs" } as const;
const seahawks = { kind: "team", id: "26", name: "Seattle Seahawks" } as const;
const chargers = { kind: "team", id: "24", name: "Los Angeles Chargers" } as const;
const game = { kind: "game", id: null, name: "Game" } as const;
const mahomes = { kind: "player", id: "3139477", name: "Patrick Mahomes" } as const;
const kelce = { kind: "player", id: "15847", name: "Travis Kelce" } as const;

/* sample: builds one sample pick and gives it its real pick ID. */
function sample(
  g: typeof KC_SEA,
  fields: Omit<NewBetPick, "id" | "gameId" | "gameLabel" | "gameStartsAt" | "league" | "sportsbook" | "period">,
): NewBetPick {
  const pick = { ...g, ...fields, league: "nfl" as const, sportsbook: "hardrock" as const, period: "full-game" as const };
  return { ...pick, id: makePickId(pick) };
}

/* The rows of sample buttons, grouped so each conflict rule is easy to try. */
const ROWS: { title: string; tip: string; picks: { pick: NewBetPick; lineText: string }[] }[] = [
  {
    title: "Spread (KC @ SEA)",
    tip: "Rule 1: tap both sides. Rule 3: tap Chiefs -3 and Chiefs -3.5.",
    picks: [
      { lineText: "KC -3", pick: sample(KC_SEA, { marketKey: "spreads", marketCategory: "game-lines", marketLabel: "Spread", participant: chiefs, side: "away", line: -3, odds: -110, label: "Chiefs -3" }) },
      { lineText: "SEA +3", pick: sample(KC_SEA, { marketKey: "spreads", marketCategory: "game-lines", marketLabel: "Spread", participant: seahawks, side: "home", line: 3, odds: -110, label: "Seahawks +3" }) },
      { lineText: "KC -3.5", pick: sample(KC_SEA, { marketKey: "alternate_spreads", marketCategory: "game-lines", marketLabel: "Alternate Spread", participant: chiefs, side: "away", line: -3.5, odds: 105, label: "Chiefs -3.5" }) },
    ],
  },
  {
    title: "Winner (KC @ SEA)",
    tip: "Rule 6: tap Chiefs to win plus Chiefs -3.",
    picks: [
      { lineText: "KC", pick: sample(KC_SEA, { marketKey: "h2h", marketCategory: "game-lines", marketLabel: "Winner", participant: chiefs, side: "away", line: null, odds: -165, label: "Chiefs to win" }) },
      { lineText: "SEA", pick: sample(KC_SEA, { marketKey: "h2h", marketCategory: "game-lines", marketLabel: "Winner", participant: seahawks, side: "home", line: null, odds: 140, label: "Seahawks to win" }) },
    ],
  },
  {
    title: "Total (KC @ SEA)",
    tip: "Rule 2: tap the over and the under.",
    picks: [
      { lineText: "O 47.5", pick: sample(KC_SEA, { marketKey: "totals", marketCategory: "game-lines", marketLabel: "Total", participant: game, side: "over", line: 47.5, odds: -110, label: "Over 47.5" }) },
      { lineText: "U 47.5", pick: sample(KC_SEA, { marketKey: "totals", marketCategory: "game-lines", marketLabel: "Total", participant: game, side: "under", line: 47.5, odds: -110, label: "Under 47.5" }) },
    ],
  },
  {
    title: "Mahomes Passing Yards (KC @ SEA)",
    tip: "Rule 5: tap both lines.",
    picks: [
      { lineText: "O 249.5", pick: sample(KC_SEA, { marketKey: "player_pass_yds", marketCategory: "player-props", marketLabel: "Passing Yards", participant: mahomes, side: "over", line: 249.5, odds: -115, label: "Mahomes Over 249.5 Passing Yards" }) },
      { lineText: "O 274.5", pick: sample(KC_SEA, { marketKey: "player_pass_yds_alternate", marketCategory: "player-props", marketLabel: "Passing Yards", participant: mahomes, side: "over", line: 274.5, odds: 180, label: "Mahomes Over 274.5 Passing Yards" }) },
    ],
  },
  {
    title: "Kelce Touchdowns (KC @ SEA)",
    tip: "Rule 4: tap anytime TD and 2+ TDs.",
    picks: [
      { lineText: "Anytime", pick: sample(KC_SEA, { marketKey: "player_anytime_td", marketCategory: "player-props", marketLabel: "Anytime TD Scorer", participant: kelce, side: "yes", line: null, odds: 120, label: "Kelce Anytime TD" }) },
      { lineText: "2+ TDs", pick: sample(KC_SEA, { marketKey: "player_tds_over", marketCategory: "player-props", marketLabel: "Touchdowns", participant: kelce, side: "over", line: 1.5, odds: 650, label: "Kelce 2+ TDs" }) },
    ],
  },
  {
    title: "A different game (LAC @ KC)",
    tip: "Allowed on a normal slip (makes a parlay). In an SGP for KC @ SEA, it opens the popup.",
    picks: [
      { lineText: "LAC +2.5", pick: sample(LAC_KC, { marketKey: "spreads", marketCategory: "game-lines", marketLabel: "Spread", participant: chargers, side: "away", line: 2.5, odds: -105, label: "Chargers +2.5" }) },
    ],
  },
];

/* SlipDemoPage: the practice page. "not found" on the live site. */
export default function SlipDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl text-gold">Slip practice</h1>
        <p className="mt-2 text-sm text-muted">
          Temporary page for Section 8. Sample prices, real saving. This page is deleted in Section 9.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-card p-4">
        <StartSgpButton gameId={KC_SEA.gameId} gameLabel={KC_SEA.gameLabel} look="button" />
        <span className="text-sm text-muted">Small game-card version:</span>
        <StartSgpButton gameId={KC_SEA.gameId} gameLabel={KC_SEA.gameLabel} look="link" />
      </div>

      {ROWS.map((row) => (
        <section key={row.title} className="rounded-2xl border border-line bg-card p-4">
          <h2 className="text-lg text-text">{row.title}</h2>
          <p className="mt-1 text-xs text-muted">{row.tip}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {row.picks.map(({ pick, lineText }) => (
              <OddsButton key={pick.id} pick={pick} lineText={lineText} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
