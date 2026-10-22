/*
  FILE: lib/auth/validation.ts
  WHAT IT'S FOR: The rules for the sign up and login forms (what counts as a
  valid email and password) and the friendly error messages when a rule is
  broken. The server checks every form with these. It never trusts the browser.
  Also has safeNextPath(), which makes sure "send me back to where I was" only
  ever goes to a page inside this app.
  WHO USES IT: app/actions/auth.ts (the Server Actions). The form components use
  the AuthFormState type and the password rule text.
  WHY THIS NAME: It's the validation (checking) for auth (login). It ends in .ts
  because it shows nothing on screen. It has no secrets, so the forms can use it too.
*/

// zod: a library for describing what data should look like and checking it, with clear error messages.
import { z } from "zod";

/** The password rules, shown under the password box so people know before they type. */
export const PASSWORD_RULES_TEXT =
  "At least 8 characters, with at least one letter and one number.";

/*
  emailRule: trims spaces, lowercases it, checks it looks like an email, and
  caps the length at 254 characters (the longest real email address).
*/
const emailRule = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, { error: "Enter your email." })
  .max(254, { error: "That email is too long." })
  .pipe(z.email({ error: "Enter a valid email, like you@example.com." }));

/*
  newPasswordRule: the rules for a NEW password at sign up.
  - 8 or more characters
  - 72 or fewer: the hashing method (bcrypt) ignores anything past 72 bytes, so
    we refuse longer passwords instead of quietly ignoring the end
  - at least one letter and one number
  Spaces are allowed, and we don't trim passwords: " pass" and "pass" are different.
*/
const newPasswordRule = z
  .string()
  .min(8, { error: "Use at least 8 characters." })
  .max(72, { error: "Use 72 characters or fewer." })
  .regex(/[a-zA-Z]/, { error: "Include at least one letter." })
  .regex(/[0-9]/, { error: "Include at least one number." });

/*
  signupSchema: email, password, and the password typed a second time.
  .refine checks the two passwords match. If they don't, the error goes on the "confirm" box.
*/
export const signupSchema = z
  .object({
    email: emailRule,
    password: newPasswordRule,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "The passwords don't match.",
    path: ["confirmPassword"],
  });

/*
  loginSchema: just checks both boxes were filled in. We don't check password
  rules at login. A wrong password gets the same "Invalid email or password."
  as everything else, so we never hint at which part was wrong.
*/
export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, { error: "Enter your password." }),
});

/** The form fields that can show an error message under them. */
export type AuthField = "email" | "password" | "confirmPassword";

/*
  AuthFormState: what a Server Action sends back to the form after a failed try.
  - message: one friendly message for the whole form, or null if there isn't one (missing on purpose).
  - fieldErrors: a message under each box that has a problem.
  - email: what the user typed, so they don't have to type it again. We
    NEVER send the password back.
*/
export type AuthFormState = {
  message: string | null;
  fieldErrors: Partial<Record<AuthField, string>>;
  email: string;
};

/** The starting state before the form has been sent: no errors. */
export const EMPTY_AUTH_FORM_STATE: AuthFormState = {
  message: null,
  fieldErrors: {},
  email: "",
};

/*
  firstFieldErrors: zod can find several problems per box. We show just the
  first one under each box, to keep it simple.
*/
export function firstFieldErrors(
  error: z.ZodError,
): Partial<Record<AuthField, string>> {
  const all = z.flattenError(error).fieldErrors as Partial<
    Record<string, string[]>
  >;
  const result: Partial<Record<AuthField, string>> = {};
  for (const field of ["email", "password", "confirmPassword"] as const) {
    const first = all[field]?.[0];
    if (first) result[field] = first;
  }
  return result;
}

/*
  safeNextPath: after logging in, we send the user back to the page they were
  trying to visit (it arrives as ?next=/betslips). SECURITY: we only allow paths
  inside THIS app. Something like "//evil.com" or "https://evil.com" could send
  the user to a fake site (an "open redirect" trick), so anything that isn't a
  plain "/something" path goes to the Feed ("/") instead.
*/
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  const isInternalPath =
    value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
  if (!isInternalPath) return "/";
  // Don't send people back to the login pages they just left.
  if (value.startsWith("/login") || value.startsWith("/signup")) return "/";
  return value;
}

/*
  formText: reads one text box from a submitted form. A form can technically
  send a file instead of text, and anything that isn't text becomes "".
*/
export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}
