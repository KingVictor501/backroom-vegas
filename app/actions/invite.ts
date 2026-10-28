/*
  FILE: app/actions/invite.ts
  WHAT IT'S FOR: The Server Action behind the invite page. When a visitor types a
  code and presses Continue, this runs on the server and:
  1. checks the visitor hasn't made too many wrong tries recently (5 wrong
     codes = a 15-minute wait)
  2. checks the code is real and good (see lib/db/inviteCodes.ts)
  3. if good: remembers it in the invite cookie and sends them on to log in or sign up
  4. if not: counts a failed try and shows ONE red message, whatever was wrong
  IMPORTANT: a good code is NOT used up here. It is only used up when an account
  is created (app/actions/auth.ts).
  WHO USES IT: components/auth/InviteForm.tsx.
  WHY THIS NAME: It lives in app/actions with the other Server Actions, named for
  the invite. It ends in .ts because it shows nothing on screen.
*/

// "use server" marks every function in this file as a Server Action: it runs on the server.
"use server";

import { redirect } from "next/navigation";
import { setInviteCookie } from "@/lib/auth/inviteCookie";
// formText and safeNextPath, from lib/auth/validation.ts: read a text box safely, and keep "next" inside this app.
import { formText, safeNextPath } from "@/lib/auth/validation";
import { findUsableInviteCode } from "@/lib/db/inviteCodes";
import { INVALID_INVITE_MESSAGE, type InviteFormState } from "@/lib/invite/format";
import { getBlockedSeconds, INVITE_ATTEMPT_RULE, recordFailedAttempt, TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/security/attempts";
import { getClientKey } from "@/lib/security/clientIp";
// logServerError (Section 1): logs only a short, cleaned-up error line.
import { logServerError } from "@/lib/logging/safeLog";

/*
  enterInviteCode: checks the typed code.
  "previousState" is what this action returned last time (React passes it in
  through useActionState). We don't need it, but it must be accepted.
*/
export async function enterInviteCode(
  previousState: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const typed = formText(formData, "code");
  const next = safeNextPath(formData.get("next"));

  // Set inside the try below. Every other path through the try returns, so it always has a value after it.
  let inviteCodeId: string;
  try {
    // Who is this? A scrambled ID made from their IP address (see lib/security/clientIp.ts).
    const clientKey = await getClientKey("invite");

    // 1. Too many wrong tries lately? Refuse WITHOUT even looking at the code,
    //    so a right code typed during a time-out gives no hint that it was right.
    if ((await getBlockedSeconds(clientKey, INVITE_ATTEMPT_RULE)) > 0) {
      return { message: TOO_MANY_ATTEMPTS_MESSAGE, code: typed };
    }

    // 2. Is it a real, good code? (A wrong shape, an unknown code, a used-up code,
    //    an expired code, and a turned-off code all come back as null.)
    const invite = await findUsableInviteCode(typed);
    if (!invite) {
      await recordFailedAttempt(clientKey, INVITE_ATTEMPT_RULE);
      return { message: INVALID_INVITE_MESSAGE, code: typed };
    }
    inviteCodeId = invite._id.toString();
  } catch (error) {
    logServerError("Invite code check failed:", error);
    return { message: "We couldn't check that code right now. Please try again.", code: typed };
  }

  // 3. A good code: remember it for 30 days and move on. (redirect() is outside
  //    the try/catch on purpose: it works by throwing, and we must not catch that.)
  await setInviteCookie(inviteCodeId);
  redirect(next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`);
}
