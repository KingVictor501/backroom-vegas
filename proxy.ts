/*
  FILE: proxy.ts
  WHAT IT'S FOR: A quick check that runs BEFORE any page loads:
  - Not logged in, and trying to open an app page → go to /login (and remember
    where they were going, so they land there after logging in).
  - Already logged in, and opening /login or /signup → go to the Feed instead.
  This is a fast "first guard" that only looks at the cookie, not the database.
  The real checks still happen next to the data (lib/auth/dal.ts and, later,
  every API route), as the Next.js docs recommend.
  WHO USES IT: Next.js runs it automatically on every matching request.
  WHY THIS NAME: Next.js 16 requires the exact name "proxy" (older versions
  called it "middleware"), in the project's main folder next to "app". It ends
  in .ts because it shows nothing on screen.
*/

import { NextResponse, type NextRequest } from "next/server";
// The cookie name and token checker from lib/auth/token.ts, the same ones used when logging in.
import { readSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";

/** Pages anyone can see without logging in. */
const LOGGED_OUT_ONLY_PATHS = ["/login", "/signup"];

/*
  proxy: decides whether to let the request through or send the visitor elsewhere.
*/
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = await readSessionToken(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
  );
  const isLoggedOutPage = LOGGED_OUT_ONLY_PATHS.includes(pathname);

  // Not logged in and not on /login or /signup → send to /login?next=<where they were going>.
  if (!session && !isLoggedOutPage) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  // Logged in but on /login or /signup → send to the Feed.
  if (session && isLoggedOutPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

/*
  config.matcher: which addresses this runs on. It's every address EXCEPT:
  - /api/...: API routes answer "not logged in" with JSON themselves (Section 6
    and 7), rather than redirecting to a page
  - /logout: must always work, even with a broken cookie
  - _next/static, _next/image, favicon.ico: the app's own files (code, styles,
    images). Blocking these would break the login page's look.
*/
export const config = {
  matcher: ["/((?!api|logout|_next/static|_next/image|favicon.ico).*)"],
};
