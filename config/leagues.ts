/*
  FILE: config/leagues.ts
  WHAT IT'S FOR: The one place that lists every league the app knows about and
  whether it's turned on. To add the NBA later, flip "enabled" to true here
  (and add its data code) instead of rewriting pages.
  WHO USES IT: app/(main)/league/[league]/page.tsx uses it now to check that a
  league in the address bar is real. Later the Feed's league tabs and the
  outside-API code will read it too.
  WHY THIS NAME: "leagues" because it describes leagues. It ends in .ts (not .tsx)
  because it's plain data and shows nothing on screen by itself.
*/

/*
  LeagueConfig: describes what we need to know about each league.
  "readonly" means the code can read these values but can't accidentally change them.
*/
export type LeagueConfig = {
  /** Short ID used in web addresses, e.g. "nfl" in /league/nfl. Lowercase, no spaces. */
  readonly slug: string;
  /** The label shown on the league tab, e.g. "NFL". */
  readonly label: string;
  /** The full name for screen readers and page titles, e.g. "National Football League". */
  readonly fullName: string;
  /** true = the tab works. false = grayed out with a "Coming soon" tooltip. */
  readonly enabled: boolean;
  /**
   * A small picture for the tab. It's an emoji for now so we don't need image files.
   * The tab will hide it from screen readers, because the label already says the league name.
   */
  readonly icon: string;
  /**
   * The name The Odds API uses for this league. Their docs list these "sport keys"
   * (for example "americanfootball_nfl"). We'll confirm it in Postman in Section 5.
   */
  readonly oddsApiSportKey: string;
  /**
   * The two parts of ESPN's web address for this league, for example
   * site.api.espn.com/apis/site/v2/sports/football/nfl/...
   */
  readonly espn: { readonly sport: string; readonly league: string };
  /** The small outlined bet-type buttons under the league tabs on the Feed. */
  readonly betTypes: readonly string[];
};

/*
  LEAGUES: the list of every league, in the order the tabs appear.
  Only NFL is turned on. The rest are ready for later.
  "as const satisfies" double-checks every entry matches LeagueConfig and keeps the values exactly as typed.
*/
export const LEAGUES = [
  {
    slug: "nfl",
    label: "NFL",
    fullName: "National Football League",
    enabled: true,
    icon: "🏈",
    oddsApiSportKey: "americanfootball_nfl",
    espn: { sport: "football", league: "nfl" },
    betTypes: ["Game Lines", "Passing", "Rushing", "Receiving", "Touchdowns"],
  },
  {
    slug: "nba",
    label: "NBA",
    fullName: "National Basketball Association",
    enabled: false,
    icon: "🏀",
    oddsApiSportKey: "basketball_nba",
    espn: { sport: "basketball", league: "nba" },
    betTypes: ["Game Lines"],
  },
  {
    slug: "nhl",
    label: "NHL",
    fullName: "National Hockey League",
    enabled: false,
    icon: "🏒",
    oddsApiSportKey: "icehockey_nhl",
    espn: { sport: "hockey", league: "nhl" },
    betTypes: ["Game Lines"],
  },
  {
    slug: "mlb",
    label: "MLB",
    fullName: "Major League Baseball",
    enabled: false,
    icon: "⚾",
    oddsApiSportKey: "baseball_mlb",
    espn: { sport: "baseball", league: "mlb" },
    betTypes: ["Game Lines"],
  },
  {
    slug: "ncaaf",
    label: "NCAAF",
    fullName: "NCAA Football",
    enabled: false,
    icon: "🏈",
    oddsApiSportKey: "americanfootball_ncaaf",
    espn: { sport: "football", league: "college-football" },
    betTypes: ["Game Lines"],
  },
  {
    slug: "ncaabb",
    label: "NCAABB",
    fullName: "NCAA Men's Basketball",
    enabled: false,
    icon: "🏀",
    oddsApiSportKey: "basketball_ncaab",
    espn: { sport: "basketball", league: "mens-college-basketball" },
    betTypes: ["Game Lines"],
  },
  {
    slug: "wnba",
    label: "WNBA",
    fullName: "Women's National Basketball Association",
    enabled: false,
    icon: "🏀",
    oddsApiSportKey: "basketball_wnba",
    espn: { sport: "basketball", league: "wnba" },
    betTypes: ["Game Lines"],
  },
] as const satisfies readonly LeagueConfig[];

/** The league the app opens on. */
export const DEFAULT_LEAGUE_SLUG = "nfl";

/*
  getLeague: looks up a league by its slug (like "nfl").
  Gives back the league, or undefined if no league has that slug.
  Pages use undefined as the signal to show "not found".
*/
export function getLeague(slug: string): LeagueConfig | undefined {
  return LEAGUES.find((league) => league.slug === slug.toLowerCase());
}
