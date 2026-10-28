/*
  FILE: lib/betting/copySlip.ts
  WHAT IT'S FOR: The RULES for copying a bet slip. Pure logic only: it never touches
  the database or the internet, so it is easy to test with plain example data.
  1. copySlipName(): the new slip's name, "Copy of Sunday Parlay", cut to the 50-character limit.
  2. planSlipCopy(): goes through the old slip's picks one by one:
     - SKIPS a pick whose game already started, finished, or was canceled (and says why)
     - REFRESHES every other pick to the sportsbook's CURRENT price and line, and
       remembers the old ones so the slip can show "was -110, now -115"
     - if the sportsbook has no odds for a pick, or the odds couldn't be looked up, KEEPS
       the pick with its old price and says so (never silently drops it)
  The odds themselves are looked up elsewhere (lib/services/slipOdds.ts) and handed in,
  which is also why tests can pretend any odds they like.
  WHO USES IT: lib/db/betslipCopy.ts (the real copy) and its tests.
  WHY THIS NAME: It's the logic for copying a slip, in lib/betting with the other slip rules.
  It ends in .ts because it shows nothing on screen. It has no secrets, so the browser could use it too.
*/

import { americanToDecimal } from "@/lib/betting/parlay";
import { formatLine, makePickId } from "@/lib/betting/picks";
import {
  BET_SLIP_NAME_MAX_LENGTH,
  type BetPick,
  type GameStatus,
  type MarketOutcome,
  type Participant,
  type PickRefreshStatus,
  type SkippedPick,
  type SportsbookId,
} from "@/types";

/** The words put in front of the old slip's name. */
const COPY_NAME_PREFIX = "Copy of ";

/** Room kept for a " (2)" to " (99)" ending when the plain name is already taken. */
const NUMBER_ROOM = 5;

/*
  clip: cuts text to at most `max` characters. JavaScript counts an emoji as 2
  characters, so a plain cut could slice one in half and leave a broken character the
  database would refuse. If that happens, the broken half is dropped too.
*/
function clip(text: string, max: number): string {
  let out = text.slice(0, max);
  if (out.length > 0 && /[\uD800-\uDBFF]/.test(out[out.length - 1])) out = out.slice(0, -1);
  return out.trimEnd();
}

/*
  copySlipName: "Copy of <old name>", never longer than 50 characters.
  needsNumberRoom: true when the plain name is taken, so the caller can add " (2)", " (3)", ...
  and the result still fits in 50.
*/
export function copySlipName(originalName: string, needsNumberRoom = false): string {
  const limit = needsNumberRoom ? BET_SLIP_NAME_MAX_LENGTH - NUMBER_ROOM : BET_SLIP_NAME_MAX_LENGTH;
  return clip(`${COPY_NAME_PREFIX}${originalName}`, limit);
}

/*
  PickOddsResult: what the lookup found for ONE pick's bet at the user's sportsbook.
  - "outcomes": the sportsbook's current choices for this bet (every line it offers,
    for both sides, for this team or player)
  - "none": the sportsbook has no odds for it right now (missing market, or the game isn't posted)
  - "not-checked": we couldn't look (The Odds API failed, or the lookup limit was reached)
*/
export type PickOddsResult =
  | { state: "outcomes"; outcomes: MarketOutcome[] }
  | { state: "none" }
  | { state: "not-checked" };

/*
  sameParticipant: is this price about the same game, team, or player as the pick?
  IDs are compared when both sides have one; otherwise names (ignoring capitals and spaces).
*/
export function sameParticipant(a: Participant, b: Participant): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "game") return true;
  if (a.id !== null && b.id !== null) return a.id === b.id;
  return a.name.trim().toLowerCase() === b.name.trim().toLowerCase();
}

/*
  chooseOutcome: which of the sportsbook's current prices replaces this pick.
  1. Same side and same team/player, and the SAME line → that one (only the price may have changed).
  2. Otherwise the line has moved (or the pick was an alternate line that's gone): take the
     book's MAIN line, the one where the two sides' prices are closest to each other,
     the same idea as the matchup page. With nothing to compare, the price closest to even money.
  null if the book has nothing for this side and team/player.
*/
function chooseOutcome(pick: BetPick, outcomes: readonly MarketOutcome[]): MarketOutcome | null {
  const mine = outcomes.filter((o) => o.side === pick.side && sameParticipant(o.participant, pick.participant));
  if (mine.length === 0) return null;
  const sameLine = mine.find((o) => o.line === pick.line);
  if (sameLine) return sameLine;
  if (mine.length === 1) return mine[0];

  const gap = (o: MarketOutcome): number => {
    const opposite = outcomes.find(
      (other) => other.side !== o.side && other.line === o.line && sameParticipant(other.participant, o.participant),
    );
    return opposite
      ? Math.abs(americanToDecimal(o.odds) - americanToDecimal(opposite.odds))
      : Math.abs(americanToDecimal(o.odds) - 2);
  };
  return mine.reduce((best, o) => (gap(o) < gap(best) ? o : best));
}

/* escapeRegex: makes text safe to search for exactly. */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
  relabel: a pick's words contain its line ("Chiefs -3", "Over 47.5", "Mahomes Over 274.5 Passing Yards").
  When the line moves, swap the old number for the new one. If the old number can't be found,
  the label is left alone (the price and line fields are still right).
*/
function relabel(pick: BetPick, newLine: number | null): string {
  if (pick.line === null || newLine === null || pick.line === newLine) return pick.label;
  const text = (line: number) => (pick.side === "over" || pick.side === "under" ? String(line) : formatLine(line));
  const pattern = new RegExp(`(^|\\s)${escapeRegex(text(pick.line))}(?=\\s|$)`);
  return pattern.test(pick.label) ? pick.label.replace(pattern, `$1${text(newLine)}`) : pick.label;
}

/*
  skipReason: why a pick can't be copied, or null if it can (missing on purpose: no reason = copy it).
  A game counts as started when ESPN says so OR its kickoff time has passed.
*/
export function pickSkipReason(pick: BetPick, status: GameStatus | undefined, nowMs: number): string | null {
  if (status === "final") return "That game is already over.";
  if (status === "canceled") return "That game was canceled.";
  if (status === "in-progress" || Date.parse(pick.gameStartsAt) <= nowMs) return "That game already started.";
  return null;
}

/*
  CopyPlan: the answer from planSlipCopy.
  - picks: the picks for the new slip (in the old slip's order)
  - skipped: the picks left out, with reasons
  - counts: how many copied picks ended up in each price-check state
*/
export type CopyPlan = {
  picks: BetPick[];
  skipped: SkippedPick[];
  counts: Record<PickRefreshStatus, number>;
};

/* PlanInput: what planSlipCopy needs. */
export type PlanInput = {
  picks: readonly BetPick[];
  /** Current prices, by the OLD pick's ID. A pick with no entry counts as "not-checked". */
  odds: ReadonlyMap<string, PickOddsResult>;
  /** What ESPN says about each game, by game ID. A game with no entry is judged by its kickoff time alone. */
  gameStatuses: ReadonlyMap<string, GameStatus>;
  /** The user's sportsbook, where the fresh prices came from. */
  sportsbook: SportsbookId;
  now: Date;
};

/*
  planSlipCopy: see the top of this file. Never changes the picks it is given.
*/
export function planSlipCopy({ picks, odds, gameStatuses, sportsbook, now }: PlanInput): CopyPlan {
  const kept: BetPick[] = [];
  // The old pick behind each kept pick, in the same order (used if a pick has to go back to its old self).
  const originals: BetPick[] = [];
  const skipped: SkippedPick[] = [];
  const addedAt = now.toISOString();

  for (const pick of picks) {
    const reason = pickSkipReason(pick, gameStatuses.get(pick.gameId), now.getTime());
    if (reason) {
      skipped.push({ label: pick.label, gameLabel: pick.gameLabel, reason });
      continue;
    }

    originals.push(pick);
    // A fresh start: the copy is added "now", and any note from an earlier copy is dropped.
    const base: BetPick = { ...pick, addedAt };
    delete base.refresh;
    const note = (status: PickRefreshStatus) => ({
      status,
      previousOdds: pick.odds,
      previousLine: pick.line,
      previousSportsbook: pick.sportsbook,
    });

    const found = odds.get(pick.id) ?? { state: "not-checked" as const };
    if (found.state !== "outcomes") {
      kept.push({ ...base, refresh: note(found.state === "none" ? "no-odds" : "not-checked") });
      continue;
    }
    const outcome = chooseOutcome(pick, found.outcomes);
    if (!outcome) {
      kept.push({ ...base, refresh: note("no-odds") });
      continue;
    }

    const moved = outcome.odds !== pick.odds || outcome.line !== pick.line;
    const updated: BetPick = {
      ...base,
      line: outcome.line,
      odds: outcome.odds,
      sportsbook,
      label: relabel(pick, outcome.line),
      refresh: note(moved ? "updated" : "unchanged"),
    };
    // The ID includes the line, so a moved line is a new ID.
    updated.id = makePickId(updated);
    kept.push(updated);
  }

  // Two different old picks (like two alternate lines) can land on the SAME current line.
  // A slip can't hold the same pick twice, so the later one goes back to its old self.
  const seen = new Set<string>();
  const finalPicks = kept.map((pick, index) => {
    if (!seen.has(pick.id)) {
      seen.add(pick.id);
      return pick;
    }
    const original = originals[index];
    const reverted: BetPick = {
      ...original,
      addedAt,
      refresh: { status: "not-checked", previousOdds: original.odds, previousLine: original.line, previousSportsbook: original.sportsbook },
    };
    seen.add(reverted.id);
    return reverted;
  });

  const counts: Record<PickRefreshStatus, number> = { updated: 0, unchanged: 0, "no-odds": 0, "not-checked": 0 };
  for (const pick of finalPicks) counts[pick.refresh?.status ?? "not-checked"] += 1;
  return { picks: finalPicks, skipped, counts };
}
