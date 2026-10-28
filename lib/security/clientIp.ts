/*
  FILE: lib/security/clientIp.ts
  WHAT IT'S FOR: Works out "who is this visitor?" for the too-many-tries guard,
  using their IP address (the number that identifies their internet connection).
  PRIVACY: the address is never saved as it is. It is scrambled with a secret
  ("HMAC", a one-way scramble that needs AUTH_SECRET), so the database holds
  only an unreadable code that still matches the same visitor each time.
  WHERE THE ADDRESS COMES FROM: Vercel puts the visitor's address in the
  "x-forwarded-for" header (and overwrites any fake one the visitor sends).
  If the header lists several addresses, the first is the visitor. When there is
  no header at all (running on your own computer), everyone shares the bucket "unknown".
  WHO USES IT: app/actions/invite.ts. The login lockout (Section 4) will use it too.
  WHY THIS NAME: It's about the client's (visitor's) IP. It lives in lib/security. It
  ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { createHmac } from "node:crypto";
// headers(): the request's headers, from Next.js. Allowed in Server Actions.
import { headers } from "next/headers";

/*
  getClientKey: a scrambled, stable ID for this visitor, safe to save in the database.
  `purpose` keeps different guards apart, so failing on the invite page never
  counts against the login page. Example result: "invite:3f9a...".
*/
export async function getClientKey(purpose: string): Promise<string> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET is missing or shorter than 32 characters.");
  }
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
  const scrambled = createHmac("sha256", secret).update(`${purpose}|${address}`).digest("hex");
  return `${purpose}:${scrambled}`;
}
