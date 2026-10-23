/*
  FILE: app/api/betslips/active/route.ts
  WHAT IT'S FOR: Your ACTIVE slip: the one you're adding picks to right now,
  shown in the slip bar (phones and tablets) or the right-side panel (desktop).
  - GET /api/betslips/active → that slip, or null if you don't have one
  - PUT /api/betslips/active → change it. Send { "slipId": "<id>" } to pick a
    slip, or { "slipId": null } for none (what "Done" does in SGP mode).
  You can only make one of YOUR OWN slips active. Anyone else's ID gets "404 not found".
  WHO USES IT: components/betslip/BetSlipProvider.tsx (the "Done" button).
  Later: the "Set as active slip" button on the slip detail page (Section 12).
  WHY THIS NAME: The folders app/api/betslips/active become /api/betslips/active.
  This exact address wins over the [id] folder next to it, and "active" can
  never be a real slip ID, so they don't clash. Route files must be named
  "route", and it ends in .ts because it sends back data, not a screen.
*/

import { apiError, parseJsonBody, withUser } from "@/lib/api/respond";
// The rule for the PUT body, from lib/betting/validation.ts.
import { activeBetSlipRule } from "@/lib/betting/validation";
// The active-slip database code from lib/db/betslips.ts. Every call includes your user ID.
import { clearActiveBetSlip, getActiveBetSlip, setActiveBetSlip } from "@/lib/db/betslips";

/* GET: logged-in users only. Answers the slip, or null if there's no active slip. */
export async function GET() {
  return withUser(async (user) => Response.json(await getActiveBetSlip(user)));
}

/* PUT: logged-in users only. Answers the newly active slip, or null after clearing it. */
export async function PUT(request: Request) {
  return withUser(async (user) => {
    const body = await parseJsonBody(request, activeBetSlipRule);
    if (!body.ok) return body.response;

    if (body.data.slipId === null) {
      await clearActiveBetSlip(user.id);
      return Response.json(null);
    }
    const slip = await setActiveBetSlip(user.id, body.data.slipId);
    return slip ? Response.json(slip) : apiError("not-found", "We couldn't find that bet slip.", 404);
  });
}
