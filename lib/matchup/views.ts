/*
  FILE: lib/matchup/views.ts
  WHAT IT'S FOR: The list of "views" (tabs) on the matchup page, and how each
  one is written in the web address. The view lives in the address, so every
  market link is a real link: it works with JavaScript off, and you can share it.
    /matchup/401873022                    → Game Lines (the default)
    /matchup/401873022?props=passing      → Player Props, Passing
    /matchup/401873022?market=halves      → Halves
    /matchup/401873022?market=quarters&quarter=2 → 2nd Quarter
  Anything unknown in the address just falls back to Game Lines.
  WHO USES IT: app/(main)/matchup/[gameId]/page.tsx and components/matchup.
  The Feed's "See Passing props" link (Section 9) uses the ?props= form.
  WHY THIS NAME: It describes the matchup page's views. It ends in .ts because
  it shows nothing on screen. It's safe to use in the browser.
*/

import type { PropCategory } from "@/types";

/* PLAYER_PROP_BUTTONS: the buttons inside Player Props, in order. */
export const PLAYER_PROP_BUTTONS: { category: PropCategory; label: string }[] = [
  { category: "touchdowns", label: "Touchdowns" },
  { category: "passing", label: "Passing" },
  { category: "rushing", label: "Rushing" },
  { category: "receiving", label: "Receiving" },
  { category: "receptions", label: "Receptions" },
];

/* MarketTab: the other tabs in the row of market links. */
export type MarketTab = "team-props" | "halves" | "quarters" | "dst" | "specials";

/* Quarter: 1 to 4. */
export type Quarter = 1 | 2 | 3 | 4;
export const QUARTERS: Quarter[] = [1, 2, 3, 4];

/* MatchupView: which tab is showing (and which button inside it). */
export type MatchupView =
  | { kind: "game-lines" }
  | { kind: "player-props"; category: PropCategory }
  | { kind: "quarters"; quarter: Quarter }
  | { kind: Exclude<MarketTab, "quarters"> };

/* MARKET_LINKS: the row of market links, in the order from your PAGES section. */
export const MARKET_LINKS: { label: string; view: MatchupView }[] = [
  { label: "Game Lines", view: { kind: "game-lines" } },
  { label: "Player Props", view: { kind: "player-props", category: "touchdowns" } },
  { label: "Team Props", view: { kind: "team-props" } },
  { label: "Halves", view: { kind: "halves" } },
  { label: "Quarters", view: { kind: "quarters", quarter: 1 } },
  { label: "D/ST", view: { kind: "dst" } },
  { label: "Game Specials", view: { kind: "specials" } },
];

/* SearchValue: what Next.js gives for one ?setting (a word, several, or nothing). */
type SearchValue = string | string[] | undefined;

/* first: the first value of a ?setting, or "" if it's missing. */
function first(value: SearchValue): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/*
  parseView: reads the address's ?settings and gives back the view.
  Only known words are accepted, so odd input can't do anything.
*/
export function parseView(search: Record<string, SearchValue>): MatchupView {
  const props = first(search.props);
  const propButton = PLAYER_PROP_BUTTONS.find((button) => button.category === props);
  if (propButton) return { kind: "player-props", category: propButton.category };

  const market = first(search.market);
  if (market === "quarters") {
    const quarter = Number(first(search.quarter));
    return { kind: "quarters", quarter: QUARTERS.find((q) => q === quarter) ?? 1 };
  }
  if (market === "team-props" || market === "halves" || market === "dst" || market === "specials") {
    return { kind: market };
  }
  return { kind: "game-lines" };
}

/* viewHref: the address for one view of one game. */
export function viewHref(gameId: string, view: MatchupView): string {
  const base = `/matchup/${encodeURIComponent(gameId)}`;
  switch (view.kind) {
    case "game-lines":
      return base;
    case "player-props":
      return `${base}?props=${view.category}`;
    case "quarters":
      return `${base}?market=quarters&quarter=${view.quarter}`;
    default:
      return `${base}?market=${view.kind}`;
  }
}

/* viewName: the words for a view, like "Halves" or "Passing props", used in messages. */
export function viewName(view: MatchupView): string {
  if (view.kind === "player-props") {
    return `${PLAYER_PROP_BUTTONS.find((b) => b.category === view.category)?.label ?? "Player"} props`;
  }
  if (view.kind === "quarters") return `${["1st", "2nd", "3rd", "4th"][view.quarter - 1]} Quarter lines`;
  return MARKET_LINKS.find((link) => link.view.kind === view.kind)?.label ?? "these odds";
}
