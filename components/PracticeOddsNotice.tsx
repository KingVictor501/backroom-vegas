/*
  FILE: components/PracticeOddsNotice.tsx
  WHAT IT'S FOR: A small yellow note that says the odds on this page are made-up "practice odds". It only
  appears on the Vercel Preview site when DUMMY_ODDS=true (lib/services/odds/dummyOdds.ts), so nobody
  mistakes them for real prices. On the live site it draws nothing.
  WHO USES IT: components/feed/LeagueGames.tsx and app/(main)/matchup/[gameId]/page.tsx.
  WHY THIS NAME: It's a notice about practice odds. It ends in .tsx because it shows something on screen.
*/

import { dummyOddsEnabled } from "@/lib/services/odds/dummyOdds";

/* PracticeOddsNotice: runs on the server, so the live site never even sends this text. */
export default function PracticeOddsNotice() {
  if (!dummyOddsEnabled()) return null;
  return (
    <p role="status" className="rounded-xl border border-gold/60 bg-card px-4 py-3 text-sm text-text">
      <span className="font-semibold text-gold">Practice odds.</span> These prices are made up for testing and are not real sportsbook odds.
    </p>
  );
}
