/*
  FILE: app/error.tsx
  WHAT IT'S FOR: The last safety net. If something breaks OUTSIDE a normal page,
  like the shared menu frame failing to load your account because the database
  is down, or a problem on the login or sign up pages, the visitor sees a short
  friendly message and a "Try again" button instead of a white screen.
  Pages inside the app have their own, closer error screens (app/(main)/error.tsx
  and others) which keep the menu on screen. This one shows only when those can't help.
  WHO USES IT: Next.js, automatically, when an error reaches the top level.
  WHY THIS NAME: "error" is the name Next.js requires. It sits directly in the
  app folder so it covers everything below it. It ends in .tsx because it shows something on screen.
*/

// "use client": error screens must run in the browser.
"use client";

// The shared error box from components/ErrorScreen.tsx.
import ErrorScreen from "@/components/ErrorScreen";

/* RootError: Next.js passes in the error and a retry function. */
export default function RootError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="px-4 py-10">
      <ErrorScreen title="Something went wrong" error={error} retry={retry} />
    </main>
  );
}
