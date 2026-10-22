/*
  FILE: app/(auth)/login/page.tsx
  WHAT IT'S FOR: The login page, at /login: a welcome heading, the login form,
  and a link to sign up. Logged-in visitors never see it, because proxy.ts sends
  them to the Feed.
  WHO USES IT: Next.js shows it at /login. proxy.ts sends logged-out visitors
  here, and the sign up page links here.
  WHY THIS NAME: The folder "login" becomes the web address, and Next.js
  requires the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The login form (a browser component) from components/auth/LoginForm.tsx.
import LoginForm from "@/components/auth/LoginForm";
// safeNextPath from lib/auth/validation.ts makes sure ?next= only points inside this app.
import { safeNextPath } from "@/lib/auth/validation";

/* The browser tab title: "Log in | The Vegas Backroom". */
export const metadata: Metadata = { title: "Log in" };

/*
  LoginPage: reads ?next= from the address (where the visitor was trying to go)
  and passes a safe version to the form. It runs on the server.
*/
export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const nextPath = safeNextPath(next);

  return (
    <div className="rounded-3xl border border-line bg-card p-6 shadow-xl shadow-black/40 sm:p-8">
      <h1 className="text-3xl text-text">Welcome back</h1>
      <p className="mt-2 text-sm text-muted">
        Log in to see your odds and bet slips.
      </p>

      <div className="mt-6">
        <LoginForm next={nextPath} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        New here?{" "}
        <Link
          // Keep ?next= when switching to sign up, so they still land in the right place.
          href={nextPath === "/" ? "/signup" : `/signup?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-gold underline underline-offset-4"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}
