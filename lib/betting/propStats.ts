/*
  FILE: lib/betting/propStats.ts
  WHAT IT'S FOR: Connects a player prop bet to the number in the live box score that decides it.
  Example: the bet "Mahomes Over 274.5 Passing Yards" (market key player_pass_yds) is decided by the
  box score stat "passing.passingYards". Anytime touchdown bets add up several kinds of touchdowns.
  Props this list does not know (like "first touchdown scorer") can't be graded, and the screen
  shows "Live" for them instead of guessing.
  Also holds toLiveStats(): turns ESPN's box score into a flat list of numbers per player.
  WHO USES IT: lib/betting/grading.ts and lib/services/espn/live.ts.
  WHY THIS NAME: It's about the stats behind props. It ends in .ts because it shows nothing on screen.
*/

/*
  PROP_STAT_KEYS: for each supported market key, the box score stats to ADD UP.
  A stat key is "<box score group>.<ESPN stat name>".
*/
const ANY_TOUCHDOWN = [
  "rushing.rushingTouchdowns",
  "receiving.receivingTouchdowns",
  "kickReturns.kickReturnTouchdowns",
  "puntReturns.puntReturnTouchdowns",
  "defensive.defensiveTouchdowns",
  "interceptions.interceptionTouchdowns",
] as const;

const PROP_STAT_KEYS: Readonly<Record<string, readonly string[]>> = {
  player_pass_yds: ["passing.passingYards"],
  player_pass_tds: ["passing.passingTouchdowns"],
  player_pass_completions: ["passing.completions"],
  player_pass_attempts: ["passing.passingAttempts"],
  player_pass_interceptions: ["passing.interceptions"],
  player_rush_yds: ["rushing.rushingYards"],
  player_rush_attempts: ["rushing.rushingAttempts"],
  player_rush_longest: ["rushing.longRushing"],
  player_reception_yds: ["receiving.receivingYards"],
  player_receptions: ["receiving.receptions"],
  player_reception_longest: ["receiving.longReception"],
  player_anytime_td: ANY_TOUCHDOWN,
  player_tds_over: ANY_TOUCHDOWN,
};

/*
  propStatKeys: the stats that decide this market, or null if we can't grade it
  (null is missing on purpose: the screen says "Live" instead).
*/
export function propStatKeys(marketKey: string): readonly string[] | null {
  return PROP_STAT_KEYS[marketKey] ?? null;
}

/*
  statTotal: adds up a player's stats for the given keys. A stat the player has not recorded
  counts as 0 (ESPN only lists a player in a group once they have a number there).
*/
export function statTotal(stats: Record<string, number>, keys: readonly string[]): number {
  return keys.reduce((total, key) => total + (stats[key] ?? 0), 0);
}

/*
  The part of ESPN's box score we read. Each group (passing, rushing, ...) lists its stat names
  ("keys") and, for each player, the matching values as text.
*/
export type BoxScoreGroup = {
  name: string;
  keys?: string[];
  athletes: { athlete: { id: string; displayName: string }; stats: string[] }[];
};

/*
  toLiveStats: flattens ESPN's box score into { playerId: { name, stats } }.
  - A value like "22/37" under the key "completions/passingAttempts" becomes two stats:
    "passing.completions" = 22 and "passing.passingAttempts" = 37.
  - Values that aren't plain numbers (like "4-18" sacks) are skipped.
*/
export function toLiveStats(groups: readonly BoxScoreGroup[]): Record<string, { name: string; stats: Record<string, number> }> {
  const players: Record<string, { name: string; stats: Record<string, number> }> = {};
  for (const group of groups) {
    const keys = group.keys ?? [];
    for (const entry of group.athletes) {
      const player = (players[entry.athlete.id] ??= { name: entry.athlete.displayName, stats: {} });
      keys.forEach((key, index) => {
        const raw = entry.stats[index];
        if (raw === undefined) return;
        if (key.includes("/")) {
          const names = key.split("/");
          const values = raw.split("/");
          names.forEach((name, part) => {
            const value = Number(values[part]);
            if (Number.isFinite(value) && values[part] !== undefined && values[part] !== "") player.stats[`${group.name}.${name}`] = value;
          });
          return;
        }
        if (!/^-?\d+(\.\d+)?$/.test(raw.trim())) return;
        player.stats[`${group.name}.${key}`] = Number(raw);
      });
    }
  }
  return players;
}
