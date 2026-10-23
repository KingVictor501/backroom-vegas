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
// The form rules, friendly messages, and helpers from lib/auth/validation.ts.
import {
  firstFieldErrors,
  formText,
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
  DUMMY_HASH: the hash of a random password nobody knows. When someone tries to log
  in with an email that DOESN'T exist, we still check their password against
  this. That way a wrong email takes just as long as a wrong password, so an
  attacker can't time the answers to find out which emails have accounts.
  It's not a secret. It's the hash of throwaway random text.
*/
const DUMMY_HASH =
  "$2b$12$Y2ap8NfuhLOkQzJV4VVZ0uNRBomosG3GEF7SEEthGUcqEurTgDlzK";

/** The one message for any failed login, so we never reveal which part was wrong. */
const INVALID_LOGIN_MESSAGE = "Invalid email or password.";

/*
  signup: creates an account, logs the user in, and sends them on.
  "previousState" is what this action returned last time (React passes it in,
  via useActionState in the form). We don't need it, but it must be accepted.
*/
export async function signup(
  previousState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const typedEmail = formText(formData, "email");

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
  try {
    await connectToDatabase();

    // 2. Is the email already taken? (The spec asks us to say so clearly.)
    if (await UserModel.exists({ email })) return emailTakenState;

    // 3. HASH THE PASSWORD. Hashing scrambles it one way: we can check a password
    // against the hash later, but nobody (not even us) can turn the hash back into the
    // password. Only the hash is saved, never the real password.
    const passwordHash = await bcrypt.hash(password, HASH_COST);

    // 4. SAVE THE USER. They start on Hard Rock Bet (the model's default).
    const user = await UserModel.create({ email, passwordHash });
    userId = user._id.toString();
  } catch (error) {
    // Two people signing up with the same email at the same instant: the
    // database's "unique email" rule catches the second one.
    if (isDuplicateKeyError(error)) return emailTakenState;
    console.error("Sign up failed:", error);
    return {
      message: "We couldn't create your account right now. Please try again.",
      fieldErrors: {},
      email: typedEmail,
    };
  }

  // 5. LOG THEM IN (set the cookie) and send them where they were headed.
  // redirect() must be outside the try/catch, because it works by throwing a special signal.
  await createSession(userId);
  redirect(safeNextPath(formData.get("next")));
}

/*
  login: checks the email and password, logs the user in, and sends them on.
  Any problem with the email or password gets the same message: "Invalid email or password."
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
    const fieldErrors = firstFieldErrors(parsed.error);
    // A badly formed email still only gets the general message, so we don't hint at anything.
    if (fieldErrors.email && typedEmail.trim() !== "") {
      return { message: INVALID_LOGIN_MESSAGE, fieldErrors: {}, email: typedEmail };
    }
    return { message: null, fieldErrors, email: typedEmail };
  }
  const { email, password } = parsed.data;

  let userId: string;
  try {
    await connectToDatabase();
    // .select("+passwordHash"): the hash is hidden by default (see the User
    // model). This is the ONE place that asks for it, to check the password.
    const user = await UserModel.findOne({ email })
      .select("+passwordHash")
      .lean();

    // Compare against the real hash, or the dummy hash if there's no such user (same timing either way).
    const passwordMatches = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !passwordMatches) {
      return { message: INVALID_LOGIN_MESSAGE, fieldErrors: {}, email: typedEmail };
    }
    userId = user._id.toString();
  } catch (error) {
    console.error("Login failed:", error);
    return {
      message: "We couldn't log you in right now. Please try again.",
      fieldErrors: {},
      email: typedEmail,
    };
  }

  await createSession(userId);
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
