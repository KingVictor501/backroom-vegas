/*
  FILE: lib/services/safePath.ts
  WHAT IT'S FOR: A safety check for the web addresses the server builds to
  call ESPN and The Odds API. It refuses any address part that is "." or ".."
  (which mean "this folder" and "go up a folder"), or that hides a "/" or "\"
  inside it. Those are how "path traversal" tricks make a server visit a
  different address than intended.
  Every page and route already checks IDs are digits before building an
  address. This is a second lock, in case a future page ever forgets.
  WHO USES IT: lib/services/espn/client.ts (espnUrl) and lib/services/odds/client.ts (oddsGet).
  Tests: lib/services/safePath.test.ts.
  WHY THIS NAME: It checks that a path is safe. It ends in .ts because it shows nothing on screen.
*/

/*
  UnsafePathError: thrown when an address part looks like a traversal trick.
  The API turns it into a plain "something went wrong" answer (no details).
*/
export class UnsafePathError extends Error {
  constructor(part: string) {
    super(`Refused an unsafe address part: ${JSON.stringify(part)}`);
    this.name = "UnsafePathError";
  }
}

/*
  assertSafePath: checks every part of a path (the bit before "?"), both as
  written and after decoding (so "%2e%2e" counts as ".."). Throws UnsafePathError
  if one is unsafe. Example: "athletes/3139477/gamelog" is fine,
  "athletes/../news" and "athletes/..%2Fnews" are refused.
*/
export function assertSafePath(path: string): void {
  const pathOnly = path.split("?")[0];
  for (const part of pathOnly.split("/")) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(part);
    } catch {
      throw new UnsafePathError(part);
    }
    if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
      throw new UnsafePathError(part);
    }
  }
}
