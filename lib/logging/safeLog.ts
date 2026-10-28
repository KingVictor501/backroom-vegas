/*
  FILE: lib/logging/safeLog.ts
  WHAT IT'S FOR: A safer way to write an error to the server log. Instead of
  printing the whole error object (which, for a database error, can carry
  connection details), it prints only the error's name and message, with any
  database connection string or login token blanked out first.
  WHO USES IT: app/actions/auth.ts (sign up and login), app/api/health/db/route.ts,
  and lib/api/respond.ts (the catch-all for API routes).
  WHY THIS NAME: It's the "safe" version of logging. It lives in lib/logging
  with other helper code, and ends in .ts because it shows nothing on screen.
  It has no secrets and no server-only code, so tests can import it directly.
*/

/** The longest log message we allow, so one huge error can't flood the logs. */
const MAX_LOG_CHARACTERS = 500;

/*
  SECRET_PATTERNS: shapes of text that must never reach a log.
  - A MongoDB connection string: starts with mongodb:// or mongodb+srv:// and
    contains the database password. "\S+" means "everything up to the next space".
  - A login token (a JWT): three chunks of letters and numbers joined by dots,
    always starting with "eyJ".
*/
const SECRET_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /mongodb(\+srv)?:\/\/\S+/gi, replacement: "[connection string hidden]" },
  { pattern: /eyJ[\w-]+\.[\w-]+\.[\w-]+/g, replacement: "[token hidden]" },
];

/*
  safeErrorText: turns anything that was thrown into one short, safe line.
  - A normal Error becomes "Name: message".
  - Anything else (a string, a number, an object) becomes a plain note, because
    we can't know what's inside it.
*/
export function safeErrorText(error: unknown): string {
  let text = error instanceof Error ? `${error.name}: ${error.message}` : "A non-error value was thrown.";
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    text = text.replace(pattern, replacement);
  }
  return text.slice(0, MAX_LOG_CHARACTERS);
}

/*
  logServerError: writes "label" plus the safe error text to the server log
  (your terminal while building, Vercel's Logs tab once live).
  Example: logServerError("Login failed:", error)
*/
export function logServerError(label: string, error: unknown): void {
  console.error(label, safeErrorText(error));
}
