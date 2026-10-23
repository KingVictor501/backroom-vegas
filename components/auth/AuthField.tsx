/*
  FILE: components/auth/AuthField.tsx
  WHAT IT'S FOR: One labeled text box (email or password) with its hint and
  error message, styled for the luxury look. Both forms use it so every box
  looks and behaves the same, including for screen readers.
  WHO USES IT: components/auth/LoginForm.tsx and components/auth/SignupForm.tsx.
  WHY THIS NAME: A field (labeled input) for the auth (login) forms. It ends in
  .tsx because it shows something on screen.
*/

// The red error line from components/ErrorMessage.tsx, so every mistake looks the same.
import { FieldError } from "@/components/ErrorMessage";

/*
  AuthFieldProps: what each form passes in.
  - name: the field's name, sent to the Server Action (like "email").
  - label: the visible label above the box.
  - type: "email" or "password" (password boxes hide what you type).
  - autoComplete: tells the browser and password managers what to fill in.
  - error: the message to show under the box, if there's a problem.
  - invalid: turns the box red even without its own message (for example, the
    login form's "Invalid email or password." is shown above both boxes).
  - hint: optional help text, like the password rules.
  - defaultValue: what to show in the box at first (used to keep the typed email after an error).
*/
type AuthFieldProps = {
  name: string;
  label: string;
  type: "email" | "password";
  autoComplete: string;
  error?: string;
  invalid?: boolean;
  hint?: string;
  defaultValue?: string;
};

/*
  AuthField: draws the label, box, hint, and error.
  Accessibility:
  - <label htmlFor> connects the label to the box, so clicking the label
    focuses the box and screen readers read the label aloud.
  - aria-invalid tells screen readers the box has a problem.
  - aria-describedby makes screen readers also read the hint and error text.
*/
export default function AuthField({
  name,
  label,
  type,
  autoComplete,
  error,
  invalid = false,
  hint,
  defaultValue,
}: AuthFieldProps) {
  const isBad = invalid || Boolean(error);
  const id = `field-${name}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : "", error ? errorId : ""].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-text">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        required
        aria-invalid={isBad ? true : undefined}
        aria-describedby={describedBy}
        // A box with a problem gets a red outline, a red glow, and a red tint, and stays red while you fix it.
        className={`mt-1.5 block w-full rounded-xl border px-4 py-3 text-base text-text placeholder:text-muted focus:outline-none
                    ${isBad ? "border-danger bg-danger/10 ring-2 ring-danger/60 focus:border-danger" : "border-line bg-bg focus:border-gold"}`}
      />
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
