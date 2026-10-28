/*
  FILE: lib/betting/grading.ts
  WHAT IT'S FOR: Works out where a pick stands from the live score: Pending, Winning, Losing,
  Push, or (once decided) Won, Lost, Push. It is pure maths on the score, so it can run in the
  browser and update the moment a new score arrives.

  HOW EACH BET IS DECIDED (a "push" means a tie with the line: you get your money back)
  - Spread: your team's score plus the line, compared with the other team's score.
      Chiefs -3, score 24-20: 24 + (-3) = 21 > 20 → winning. If it were 23-20: 23 - 3 = 20 → push.
  - Total (over/under): both teams' points added up, compared with the line.
  - Team total: one team's points compared with the line.
  - Moneyline (winner): whose score is higher; a tie is a push.
  - Player prop: the player's box score number compared with the line (over/under), or "yes/no"
    for touchdown bets. If the box score isn't available, or the prop isn't supported, the
    answer is "live" with no outcome, and the screen just says "Live".
  - Halves and quarters count only that part of the game. Such a bet is decided as soon as that
    part ends, even while the game goes on.

  Over/under bets are shown as "Winning" while the number is on your side, even though it can
  still change (an Under on a total can still lose). That is how sportsbooks show live bets too.
  WHO USES IT: the live score components (slip pages, matchup page).
  WHY THIS NAME: It grades picks. It lives in lib/betting with the other pick logic. It ends in .ts
  because it shows nothing on screen, and it has no secrets, so the browser can use it.
*/

import { propStatKeys, statTotal } from "@/lib/betting/propStats";
import type { BetPick, LiveGame, PickGrade, PickOutcome } from "@/types";

/* compare: bigger than the line = "win" for the side that wants more, 0 = push. */
function bySign(difference: number): PickOutcome {
  if (difference > 0) return "win";
  if (difference < 0) return "lose";
  return "push";
}

/* PeriodSlice: the first and last period (1-based) a bet counts, or null for the full game. */
function periodRange(period: BetPick["period"], regulation: number): { from: number; to: number } | null {
  switch (period) {
    case "full-game":
      return null;
    case "first-half":
      return { from: 1, to: Math.floor(regulation / 2) };
    // The second half includes overtime, like sportsbooks count it.
    case "second-half":
      return { from: Math.floor(regulation / 2) + 1, to: Number.POSITIVE_INFINITY };
    case "q1":
      return { from: 1, to: 1 };
    case "q2":
      return { from: 2, to: 2 };
    case "q3":
      return { from: 3, to: 3 };
    case "q4":
      return { from: 4, to: 4 };
  }
}

/* sumPeriods: adds the points from period `from` to `to` (1-based). */
function sumPeriods(points: readonly number[], from: number, to: number): number {
  return points.slice(from - 1, Number.isFinite(to) ? to : undefined).reduce((total, value) => total + value, 0);
}

/*
  gradePick: where this pick stands, given the game's live information.
  - regulation: how many periods before overtime (4 for football), from config/leagues.ts
  - game: null when we have no live information for the game (the pick then stays "pending" if the game
    hasn't started, or "live" with no outcome if we just can't tell).
  - now: only used when game is null, to tell "not started" from "can't tell".
*/
export function gradePick(pick: BetPick, game: LiveGame | null, regulation: number, now: number = Date.now()): PickGrade {
  if (game === null) {
    const started = Date.parse(pick.gameStartsAt) <= now;
    return { phase: started ? "live" : "pending", outcome: null };
  }
  if (game.status === "scheduled" || game.status === "postponed" || game.status === "canceled") {
    return { phase: "pending", outcome: null };
  }

  const gameOver = game.status === "final";
  const range = periodRange(pick.period, regulation);

  // Is the part of the game this bet covers finished? A full-game bet is finished when the game is.
  let phase: PickGrade["phase"] = gameOver ? "final" : "live";
  if (range !== null && !gameOver) {
    const current = game.period ?? 1;
    // This part hasn't started yet. (At halftime the period is still 2, so the second half is not started.)
    if (current < range.from) return { phase: "pending", outcome: null };
    // This part is over: a later period has started, or it's the first half and the game is at halftime.
    if (current > range.to || (pick.period === "first-half" && game.halftime)) phase = "final";
  }

  const outcome = outcomeOf(pick, game, range);
  return { phase, outcome };
}

/* outcomeOf: who is ahead right now (or who won), or null if this kind of bet can't be worked out. */
function outcomeOf(pick: BetPick, game: LiveGame, range: { from: number; to: number } | null): PickOutcome | null {
  const isPlayerProp = pick.marketCategory === "player-props" || pick.marketKey.startsWith("player_");
  if (isPlayerProp) return propOutcome(pick, game);

  // Points for the part of the game this bet covers.
  let away = game.awayScore;
  let home = game.homeScore;
  if (range !== null) {
    if (game.awayPeriods.length === 0 || game.homePeriods.length === 0) return null;
    away = sumPeriods(game.awayPeriods, range.from, range.to);
    home = sumPeriods(game.homePeriods, range.from, range.to);
  }
  if (away === null || home === null) return null;

  const key = pick.marketKey;
  if (/^(alternate_)?spreads(_(h1|h2|q[1-4]))?$/.test(key)) {
    if (pick.line === null || (pick.side !== "home" && pick.side !== "away")) return null;
    const mine = pick.side === "home" ? home : away;
    const theirs = pick.side === "home" ? away : home;
    return bySign(mine + pick.line - theirs);
  }
  if (/^(alternate_)?totals(_(h1|h2|q[1-4]))?$/.test(key)) {
    if (pick.line === null) return null;
    return overUnder(pick.side, home + away, pick.line);
  }
  if (/^team_totals(_(h1|h2|q[1-4]))?$/.test(key)) {
    if (pick.line === null) return null;
    const id = pick.participant.id;
    if (id === game.homeTeamId) return overUnder(pick.side, home, pick.line);
    if (id === game.awayTeamId) return overUnder(pick.side, away, pick.line);
    return null;
  }
  if (/^h2h(_(h1|h2|q[1-4]))?$/.test(key)) {
    if (pick.side !== "home" && pick.side !== "away") return null;
    const mine = pick.side === "home" ? home : away;
    const theirs = pick.side === "home" ? away : home;
    return bySign(mine - theirs);
  }
  return null;
}

/* overUnder: "over" wins when the number is above the line, "under" when below; equal is a push. */
function overUnder(side: BetPick["side"], value: number, line: number): PickOutcome | null {
  if (side === "over") return bySign(value - line);
  if (side === "under") return bySign(line - value);
  return null;
}

/* propOutcome: a player prop, from the live box score. */
function propOutcome(pick: BetPick, game: LiveGame): PickOutcome | null {
  const keys = propStatKeys(pick.marketKey);
  // A half-only prop (like player_anytime_td_h1) isn't supported, because the box score isn't split by half.
  if (keys === null || game.players === null || pick.period !== "full-game") return null;

  const player = findPlayer(pick, game);
  // A player who isn't in the box score yet has recorded nothing, so their number is 0.
  const value = player ? statTotal(player.stats, keys) : 0;

  if (pick.side === "yes") return value >= 1 ? "win" : "lose";
  if (pick.side === "no") return value >= 1 ? "lose" : "win";
  if (pick.line === null) return null;
  return overUnder(pick.side, value, pick.line);
}

/* findPlayer: the pick's player in the box score, by ID first, then by name (names are compared in lowercase). */
function findPlayer(pick: BetPick, game: LiveGame): { stats: Record<string, number> } | null {
  const players = game.players ?? {};
  if (pick.participant.id && players[pick.participant.id]) return players[pick.participant.id];
  const wanted = pick.participant.name.trim().toLowerCase();
  return Object.values(players).find((player) => player.name.trim().toLowerCase() === wanted) ?? null;
}

/*
  gradeLabel: the words for the badge. Decided bets say Won/Lost; bets in play say
  Winning/Losing; "Live" when we can't tell; "Pending" before the game.
*/
export function gradeLabel(grade: PickGrade): string {
  if (grade.phase === "pending") return "Pending";
  if (grade.outcome === null) return grade.phase === "final" ? "Final" : "Live";
  if (grade.outcome === "push") return "Push";
  if (grade.phase === "final") return grade.outcome === "win" ? "Won" : "Lost";
  return grade.outcome === "win" ? "Winning" : "Losing";
}
