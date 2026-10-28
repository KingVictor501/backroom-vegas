/*
  FILE: app/actions/auth.ts
  WHAT IT'S FOR: The Server Actions for signing up, logging in, and logging out.
  A Server Action is a function that runs ONLY on the server, but a form in the
  browser can call it directly, with no API route needed. Passwords go straight
  from the form to the server and are never handled by browser code.
  This is the "advanced feature" for the rubric.
  WHO USES IT: components/auth/SignupForm.tsx, components/auth/LoginForm.tsx, and
  components/auth/LogoutButton.tsx.
  WHY THIS NAME: It lives in app/actions (the folder the Next.js docs use for
  actions; it's not a page, since it has no page.tsx). "auth" because it's all
  about logging in. It ends in .ts because it shows nothing on screen.
*/

// "use server" marks every function in this file as a Server Action: it runs on
// the server even when a form in the browser calls it.
"use server";

// bcryptjs: the password hashing library (more on hashing in signup below).
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
// The shared database connection and the User model from Section 3.
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/db/models/User";
// isDuplicateKeyError from lib/db/errors.ts: spots "that email is already used".
import { isDuplicateKeyError } from "@/lib/db/errors";
// Cookie helpers from lib/auth/session.ts: log in = create the cookie, log out = delete it.
import { createSession, deleteSession } from "@/lib/auth/session";
// logServerError from lib/logging/safeLog.ts: logs only a short, cleaned-up error line (never the whole error object).
import { logServerError } from "@/lib/logging/safeLog";
// The invite cookie helpers (lib/auth/inviteCookie.ts) and the invite code database code (lib/db/inviteCodes.ts):
// sign up must hold a valid invite, and it uses up one spot on the code when the account is created.
import { deleteInviteCookie, getInviteCodeId } from "@/lib/auth/inviteCookie";
import { claimInviteUse, releaseInviteUse } from "@/lib/db/inviteCodes";
// attemptLogin from lib/auth/loginAttempt.ts: the shared login check, with the too-many-tries lockout.
import { attemptLogin, type LoginResult } from "@/lib/auth/loginAttempt";
// The lockout message, from lib/security/attempts.ts.
import { TOO_MANY_ATTEMPTS_MESSAGE } from "@/lib/security/attempts";
// The form rules, friendly messages, and helpers from lib/auth/validation.ts.
import {
  firstFieldErrors,
  formText,
  INVALID_LOGIN_MESSAGE,
  loginSchema,
  safeNextPath,
  signupSchema,
  type AuthFormState,
} from "@/lib/auth/validation";

/*
  HASH_COST: how much work hashing takes (bcrypt's "cost"). Each +1 doubles the
  time. 12 takes about 0.2 seconds, which barely slows a real login but makes
  guessing millions of passwords far too slow.
*/
const HASH_COST = 12;

/*
  signup: creates an account, logs the user in, and sends them on.
  INVITE CODES: no valid invite cookie → straight back to /invite. The cookie only
  proves the code was good when it was typed, so here the code is checked AGAIN
  in the database, and its use is counted in the SAME database command that
  checks it (claimInviteUse), so two people can't take the last spot together.
  If the account then can't be created, the spot is handed back.
  "previousState" is what this action returned last time (React passes it in,
  via useActionState in the form). We don't need it, but it must be accepted.
*/
export async function signup(
  previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const typedEmail = formText(formData, "email");

  // 0. NO VALID INVITE COOKIE → back to the invite page. proxy.ts already keeps
  // people away from /signup without one, but a Server Action can be called
  // directly (from Postman, say), so it checks for itself.
  const inviteCodeId = await getInviteCodeId();
  if (inviteCodeId === null) redirect("/invite");

  // 1. CHECK THE FORM on the server, even though the browser checks some things too.
  const parsed = signupSchema.safeParse({
    email: typedEmail,
    password: formText(formData, "password"),
    confirmPassword: formText(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return {
      message: "Please fix the highlighted fields.",
      fieldErrors: firstFieldErrors(parsed.error),
      email: typedEmail,
    };
  }
  const { email, password } = parsed.data;
  const emailTakenState: AuthFormState = {
    message: null,
    fieldErrors: {
      email: "An account with this email already exists. Try logging in instead.",
    },
    email: typedEmail,
  };

  let userId: string;
  // true if the invite code was no longer good when we tried to use it (see step 4).
  let inviteRejected = false;
  try {
    await connectToDatabase();

    // 2. Is the email already taken? (The spec asks us to say so clearly.)
    if (await UserModel.exists({ email })) return emailTakenState;

    // 3. HASH THE PASSWORD. Hashing scrambles it one way: we can check a password
    // against the hash later, but nobody (not even us) can turn the hash back into the
    // password. Only the hash is saved, never the real password.
    const passwordHash = await bcrypt.hash(password, HASH_COST);

    // 4. USE ONE SPOT ON THE INVITE CODE, in one database command that also checks
    // the code is still turned on, unexpired, and has spots left. If it isn't
    // good anymore (or someone else just took the last spot), we get null.
    const invite = await claimInviteUse(inviteCodeId);
    if (invite === null) {
      inviteRejected = true;
      userId = "";
    } else {
      // 5. SAVE THE USER, remembering which invite code they used. They start on
      // Hard Rock Bet (the model's default). If saving fails (for example, the
      // same email was taken a split second ago), hand the spot back so a failed
      // sign up doesn't burn it, then let the error be handled below.
      try {
        const user = await UserModel.create({ email, passwordHash, inviteCodeId: invite._id });
        userId = user._id.toString();
      } catch (error) {
        await releaseInviteUse(inviteCodeId);
        throw error;
      }
    }
  } catch (error) {
    // Two people signing up with the same email at the same instant: the
    // database's "unique email" rule catches the second one.
    if (isDuplicateKeyError(error)) return emailTakenState;
    logServerError("Sign up failed:", error);
    return {
      message: "We couldn't create your account right now. Please try again.",
      fieldErrors: {},
      email: typedEmail,
    };
  }

  // The invite code stopped being good between entering it and now (used up, expired,
  // or turned off). Forget it and go back to the invite page with the one red message.
  if (inviteRejected) {
    await deleteInviteCookie();
    redirect("/invite?error=invalid");
  }

  // 6. LOG THEM IN (set the cookie) and send them where they were headed.
  // redirect() must be outside the try/catch, because it works by throwing a special signal.
  await createSession(userId);
  redirect(safeNextPath(formData.get("next")));
}

/*
  login: checks the email and password, logs the user in, and sends them on.
  Any problem with the email or password gets the same message: "Invalid email or password."
  After 5 wrong passwords for an email (or 20 from one address), logging in is
  blocked for 15 minutes with "Too many attempts. Try again in a few minutes."
  (the rules live in lib/auth/loginAttempt.ts and lib/security/attempts.ts).
*/
export async function login(
  previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const typedEmail = formText(formData, "email");

  const parsed = loginSchema.safeParse({
    email: typedEmail,
    password: formText(formData, "password"),
  });
  if (!parsed.success) {
    // Show what's wrong with the email itself (like "Use an email ending in .com, ...")
    // in red under the box. These rules are the same for everyone, so they never
    // reveal whether an account exists. A wrong email or password for a real-looking
    // address still only gets "Invalid email or password." (below).
    return { message: null, fieldErrors: firstFieldErrors(parsed.error), email: typedEmail };
  }
  const { email, password } = parsed.data;

  // One shared login check (lib/auth/loginAttempt.ts): the lockout, then the password.
  let result: LoginResult;
  try {
    result = await attemptLogin(email, password);
  } catch (error) {
    logServerError("Login failed:", error);
    return {
      message: "We couldn't log you in right now. Please try again.",
      fieldErrors: {},
      email: typedEmail,
    };
  }

  if (!result.ok) {
    // Locked out: too many wrong tries. Otherwise the one vague message, whatever was wrong.
    return {
      message: result.reason === "locked" ? TOO_MANY_ATTEMPTS_MESSAGE : INVALID_LOGIN_MESSAGE,
      fieldErrors: {},
      email: typedEmail,
    };
  }

  // Logged in: set the cookie and go. redirect() must be outside the try/catch,
  // because it works by throwing a special signal.
  await createSession(result.user.id);
  redirect(safeNextPath(formData.get("next")));
}

/*
  logout: deletes the login cookie and goes to the login page.
  Their bet slips stay saved in the database for next time.
*/
export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
