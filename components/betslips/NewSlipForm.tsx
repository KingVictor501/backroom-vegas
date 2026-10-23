/*
  FILE: components/betslips/NewSlipForm.tsx
  WHAT IT'S FOR: The New Slip form: a name (optional: leave it blank and the
  server names it with today's date, like "10-23-2026") and a checkbox to
  make it your active slip (the one your taps add to). It sends the form to
  POST /api/betslips, then opens the new slip's page.
  Mistakes (a name over 50 characters, or one you already used) show in red
  under the box. The server checks everything again, so nothing can be faked.
  WHO USES IT: app/(main)/betslips/new/page.tsx.
  WHY THIS NAME: It's the form for a new slip. It ends in .tsx because it shows something on screen.
*/

"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
// The bet slip provider: so a new active slip shows in the slip bar right away.
import { useBetSlip } from "@/components/betslip/BetSlipProvider";
// The red error styles from components/ErrorMessage.tsx.
import ErrorMessage, { FieldError } from "@/components/ErrorMessage";
// createSlip from lib/betting/slipRequests.ts: POST /api/betslips.
import { createSlip, SlipRequestError } from "@/lib/betting/slipRequests";
// The 50-character limit, shared with the server.
import { BET_SLIP_NAME_MAX_LENGTH } from "@/types";

/* NewSlipForm */
export default function NewSlipForm() {
  const router = useRouter();
  const { replaceActiveSlip, announce } = useBetSlip();
  const [name, setName] = useState("");
  const [makeActive, setMakeActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const nameId = useId();
  const errorId = `${nameId}-error`;

  /* onSubmit: checks the length here first (instant), then lets the server decide. */
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNameError(null);
    setFormError(null);
    if (name.trim().length > BET_SLIP_NAME_MAX_LENGTH) {
      return setNameError(`Slip names can be up to ${BET_SLIP_NAME_MAX_LENGTH} characters.`);
    }
    setSaving(true);
    try {
      const slip = await createSlip({ name: name.trim() || undefined, setActive: makeActive });
      if (makeActive) replaceActiveSlip(slip);
      announce(`Created "${slip.name}".`);
      router.push(`/betslips/${slip.id}`);
    } catch (error) {
      setSaving(false);
      if (error instanceof SlipRequestError && error.fieldErrors.name) return setNameError(error.fieldErrors.name);
      setFormError(error instanceof Error ? error.message : "Your slip didn't save. Please try again.");
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-2xl border border-line bg-card p-5">
      {formError && <ErrorMessage>{formError}</ErrorMessage>}

      <div>
        <label htmlFor={nameId} className="block text-sm font-medium text-text">
          Slip name <span className="text-muted">(optional)</span>
        </label>
        <input
          id={nameId}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Leave blank for today's date"
          maxLength={BET_SLIP_NAME_MAX_LENGTH + 10}
          autoComplete="off"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? errorId : undefined}
          className={`mt-1.5 block w-full rounded-xl border px-4 py-3 text-base text-text placeholder:text-muted focus:outline-none ${
            nameError ? "border-danger bg-danger/10 ring-2 ring-danger/60" : "border-line bg-bg focus:border-gold"
          }`}
        />
        <p className="mt-1.5 text-xs text-muted">
          {name.trim().length}/{BET_SLIP_NAME_MAX_LENGTH} characters
        </p>
        {nameError && <FieldError id={errorId}>{nameError}</FieldError>}
      </div>

      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-text">
        <input
          type="checkbox"
          checked={makeActive}
          onChange={(event) => setMakeActive(event.target.checked)}
          className="size-5 accent-[var(--color-gold)]"
        />
        Make this my active slip (odds I tap will go on it)
      </label>

      <button
        type="submit"
        disabled={saving}
        className="min-h-12 w-full rounded-xl bg-gold px-5 font-semibold text-bg hover:bg-gold-bright disabled:cursor-wait disabled:opacity-70"
      >
        {saving ? "Creating…" : "Create slip"}
      </button>
    </form>
  );
}
