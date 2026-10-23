/*
  FILE: components/betslip/StartSgpButton.tsx
  WHAT IT'S FOR: Starts Build your own SGP for one game. It comes in two looks:
  - "button": the gold-outlined "Build your own SGP" button on the matchup page
  - "link": the small "SGP" link on each game card on the Feed and league pages
  Once you're building that game's SGP, it says so instead.
  WHO USES IT: Later: game cards (Section 9) and the matchup page (Section 10).
  WHY THIS NAME: It starts an SGP. It ends in .tsx because it shows something on screen.
*/

"use client";

// useBetSlip from components/betslip/BetSlipProvider.tsx: starts the SGP and knows if one is in progress.
import { useBetSlip } from "./BetSlipProvider";

/*
  StartSgpButton
  - gameId: our game ID (ESPN's event ID)
  - gameLabel: the short game name, like "KC @ SEA". The slip is named "KC @ SEA SGP".
  - look: "button" (big, matchup page) or "link" (small, game cards)
*/
export default function StartSgpButton({
  gameId,
  gameLabel,
  look,
}: {
  gameId: string;
  gameLabel: string;
  look: "button" | "link";
}) {
  const { slip, startSgp } = useBetSlip();
  const building = slip?.sgpGameId === gameId;

  if (look === "link") {
    return (
      <button
        type="button"
        onClick={() => startSgp({ gameId, gameLabel })}
        aria-label={building ? `Building an SGP for ${gameLabel}` : `Build your own SGP for ${gameLabel}`}
        className="min-h-11 px-2 text-xs font-semibold text-gold underline-offset-4 hover:underline"
      >
        {building ? "Building SGP" : "SGP"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => startSgp({ gameId, gameLabel })}
      className={`min-h-11 w-full rounded-xl border border-gold px-5 text-sm font-semibold transition-colors sm:w-auto ${
        building ? "bg-gold text-bg" : "text-gold hover:bg-gold hover:text-bg"
      }`}
    >
      {building ? "Building your SGP" : "Build your own SGP"}
    </button>
  );
}
