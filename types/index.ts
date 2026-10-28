/*
  FILE: types/index.ts
  WHAT IT'S FOR: One front door to every shared type. Other files can write
  `import type { BetSlip, Game } from "@/types"` instead of remembering which
  file each type lives in.
  WHO USES IT: Any file that needs a shared type (most files from Section 3 on).
  WHY THIS NAME: "index" is the file JavaScript opens automatically when you
  import a folder ("@/types" means "@/types/index"). It ends in .ts because it
  shows nothing on screen.

  ABOUT null IN THESE TYPES: whenever a field says "| null", null means
  "missing on purpose". There's no value, like an empty slip that has no
  combined odds yet, or a team with no logo from ESPN. It's NOT leftover or
  temporary code. TypeScript makes every page handle the null case before using
  the value, so a page shows a dash or a friendly message instead of crashing.
*/

export * from "./api";
export * from "./betslip";
export * from "./game";
export * from "./league";
export * from "./live";
export * from "./news";
export * from "./odds";
export * from "./player";
export * from "./props";
export * from "./search";
export * from "./sportsbook";
export * from "./team";
export * from "./user";
