/*
  FILE: app/(auth)/signup/page.tsx
  WHAT IT'S FOR: The sign up page, at /signup: a heading, the sign up form, and
  a link to log in. There's no email verification, so graders can sign up and
  use the app right away.
  WHO USES IT: Next.js shows it at /signup. The login page links here.
  WHY THIS NAME: The folder "signup" becomes the web address, and Next.js
  requires the file name "page". It ends in .tsx because it shows something on screen.
*/

import type { Metadata } from "next";
import Link from "next/link";
// The sign up form (a browser component) from components/auth/SignupForm.tsx.
import SignupForm from "@/components/auth/SignupForm";
// safeNextPath from lib/auth/validation.ts makes sure ?next= only points inside this app.
import { safeNextPath } from "@/lib/auth/validation";

/* The browser tab title: "Sign up | The Vegas Backroom". */
export const metadata: Metadata = { title: "Sign up" };

/* SignupPage: reads ?next= safely and shows the form. It runs on the server. */
export default async function SignupPage(props: PageProps<"/signup">) {
  const { next } = await props.searchParams;
  const nextPath = safeNextPath(next);

  return (
    <div className="rounded-3xl border border-line bg-card p-6 shadow-xl shadow-black/40 sm:p-8">
      <h1 className="text-3xl text-text">Create your account</h1>
      <p className="mt-2 text-sm text-muted">
        Compare odds and build bet slips. This is a reference tool only: no
        real bets, no real money.
      </p>

      <div className="mt-6">
        <SignupForm next={nextPath} />
      </div>

      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={nextPath === "/" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`}
          className="font-medium text-gold underline underline-offset-4"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
