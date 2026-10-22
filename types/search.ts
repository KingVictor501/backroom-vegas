/*
  FILE: types/search.ts
  WHAT IT'S FOR: What one search result looks like ("Find a team or player").
  WHO USES IT: Later: the search API route (Section 6) and the search bar on the Feed (Section 9).
  WHY THIS NAME: It describes search results, in the types folder. It ends in .ts
  because it shows nothing on screen.
*/

// A team result uses the same short team description as game cards.
import type { TeamSummary } from "./team";
// A player result uses the same short player description as prop tables.
import type { PlayerSummary } from "./player";

/*
  SearchResult: either a team or a player. "kind" says which, so the page knows
  whether to link to /team/<id> or /player/<id>.
*/
export type SearchResult =
  | { kind: "team"; team: TeamSummary }
  | { kind: "player"; player: PlayerSummary };
