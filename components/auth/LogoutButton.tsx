/*
  FILE: components/auth/LogoutButton.tsx
  WHAT IT'S FOR: The "Log out" button. It's a tiny form that calls the logout
  Server Action, which deletes the login cookie and goes to /login.
  WHO USES IT: app/(main)/settings/page.tsx.
  WHY THIS NAME: It's the button for logging out. It ends in .tsx because it
  shows something on screen.
*/

// The logout Server Action from app/actions/auth.ts.
import { logout } from "@/app/actions/auth";

/*
  LogoutButton: a form with one button. Because it's a real <form> that calls
  a Server Action, it works even with JavaScript turned off. It has no
  "use client" because it doesn't need any browser-side code.
*/
export default function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="rounded-full border border-gold px-6 py-2.5 font-semibold text-gold transition-colors hover:bg-gold hover:text-bg"
      >
        Log out
      </button>
    </form>
  );
}
