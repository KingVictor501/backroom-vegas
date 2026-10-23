/*
  FILE: app/actions/settings.ts
  WHAT IT'S FOR: The Server Action that saves your sportsbook choice (Hard
  Rock Bet, BetMGM, or Caesars) to your account. After saving, it refreshes
  the page, so odds everywhere come from the new book. Picks already on your
  slips keep the book they came from (each pick saved its own sportsbook).
  Server Actions for login, sign up, and settings are the rubric's "advanced feature".
  WHO USES IT: components/settings/SportsbookPicker.tsx (the cards on /settings).
  WHY THIS NAME: Server Actions live in app/actions, and this one is for
  settings. It ends in .ts because it shows nothing on screen.
*/

// "use server": every function in this file runs ONLY on the server, even
// though the Settings form in the browser calls it.
"use server";

import { refresh } from "next/cache";
import { z } from "zod";
// requireUser from lib/auth/dal.ts: only a logged-in user can change their own settings.
import { requireUser } from "@/lib/auth/dal";
import { connectToDatabase } from "@/lib/db/mongodb";
import { UserModel } from "@/lib/db/models/User";
// The sportsbook names, for the "Saved" message.
import { SPORTSBOOKS } from "@/config/sportsbooks";
// The three allowed sportsbook IDs, from the types folder.
import { SPORTSBOOK_IDS, type SportsbookId } from "@/types";

/*
  SettingsFormState: what the action sends back to the form.
  - status "saved" (with a message) or "error" (with a message), or "idle" before anything happens
*/
export type SettingsFormState = {
  status: "idle" | "saved" | "error";
  message: string;
  sportsbook: SportsbookId | null;
};

/* The rule: the form must send one of the three sportsbook IDs. Anything else is refused. */
const sportsbookRule = z.enum(SPORTSBOOK_IDS, { error: "Choose Hard Rock Bet, BetMGM, or Caesars." });

/*
  saveSportsbook: saves the chosen book to the logged-in user's account.
  The user's ID comes from their login cookie (requireUser), never from the
  form, so nobody can change someone else's settings.
*/
export async function saveSportsbook(previous: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const user = await requireUser();
  const parsed = sportsbookRule.safeParse(formData.get("sportsbook"));
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Choose a sportsbook.", sportsbook: previous.sportsbook };
  }

  await connectToDatabase();
  await UserModel.updateOne({ _id: user.id }, { $set: { preferredSportsbook: parsed.data } });

  // Rebuild the page with the new choice (and the odds from that book on the next page you open).
  refresh();
  return { status: "saved", message: `Saved. Odds now come from ${SPORTSBOOKS[parsed.data].name}.`, sportsbook: parsed.data };
}
