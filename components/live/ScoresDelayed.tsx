/*
  FILE: components/live/ScoresDelayed.tsx
  WHAT IT'S FOR: A small note shown when the last live score refresh failed: "Scores delayed". The screen
  keeps showing the last known scores, and this note explains they may be a little behind. It disappears by
  itself after the next successful refresh.
  WHO USES IT: components/feed/GameBrowser.tsx, components/matchup/MatchupHeader.tsx, components/betslips/SlipDetail.tsx.
  WHY THIS NAME: It says the scores are delayed. It ends in .tsx because it shows something on screen.
*/

/* ScoresDelayed: draws nothing unless `show` is true. role="status" lets screen readers mention it politely. */
export default function ScoresDelayed({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="status" className="text-xs font-semibold text-gold">
      Scores delayed. Showing the last scores we have.
    </p>
  );
}
