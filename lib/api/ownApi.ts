/*
  FILE: lib/api/ownApi.ts
  WHAT IT'S FOR: Lets a SERVER page call one of our own API routes, like
  GET /api/betslips, the way the Bet Slips list does (your rubric asks for the
  list to use that route). It passes the visitor's login cookie along, so the
  route knows whose slips to return.
  SAFETY: the address always comes from APP_URL in your settings (.env.local
  on your computer, Environment Variables on Vercel), never from the incoming
  request. So nobody can trick the server into sending someone's login cookie
  to a different website.
  WHO USES IT: app/(main)/betslips/page.tsx.
  WHY THIS NAME: It calls our own API. It ends in .ts because it shows nothing on screen.
*/

import "server-only";
import { cookies } from "next/headers";

/*
  OwnApiError: the route answered with an error (like 401 or 500).
  status is the HTTP code, so the page can decide what to show.
*/
export class OwnApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "OwnApiError";
  }
}

/*
  getFromOwnApi: GET one of our routes and give back its JSON.
  - path: like "/api/betslips"
  The <Result> type is what our own route sends back, so we trust its shape.
  cache: "no-store" means it always asks fresh (your slips change as you use the app).
*/
export async function getFromOwnApi<Result>(path: string): Promise<Result> {
  const base = process.env.APP_URL?.replace(/\/+$/, "");
  if (!base) throw new Error("APP_URL is missing. Add it to .env.local (and to Vercel's Environment Variables).");

  const cookieHeader = (await cookies()).toString();
  const response = await fetch(`${base}${path}`, { headers: { cookie: cookieHeader }, cache: "no-store" });
  if (!response.ok) throw new OwnApiError(response.status, `${path} answered ${response.status}`);
  return (await response.json()) as Result;
}
