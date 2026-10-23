/*
  FILE: app/api/betslips/[id]/route.ts
  WHAT IT'S FOR: One bet slip, by its ID.
  - GET    /api/betslips/<id> → the slip
  - PATCH  /api/betslips/<id> → rename it and/or replace its picks. Send JSON like
    { "name": "New name" } or { "picks": [ ... ] }
  - DELETE /api/betslips/<id> → deletes it
  A fake ID, a badly formed ID, or someone else's slip all get the same
  "404 not found". That way nobody can find out whether another user's slip exists.
  WHO USES IT: Postman tests now. Later: the slip detail page (Section 12) and
  the odds buttons that add and remove picks (Section 8).
  WHY THIS NAME: "[id]" is a dynamic folder (the slip ID from the address).
  Route files must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { apiError, parseJsonBody, withUser } from "@/lib/api/respond";
// The rules for changing a slip, from lib/betting/validation.ts.
import { updateBetSlipRule } from "@/lib/betting/validation";
// The bet slip database code from lib/db/betslips.ts. Every call includes the user's ID.
import { deleteBetSlip, getBetSlip, SlipNameTakenError, updateBetSlip } from "@/lib/db/betslips";

/** The one "not found" answer, used for fake IDs AND other people's slips. */
function slipNotFound(): Response {
  return apiError("not-found", "We couldn't find that bet slip.", 404);
}

/* GET: logged-in users only. */
export async function GET(_request: Request, context: RouteContext<"/api/betslips/[id]">) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const slip = await getBetSlip(user.id, id);
    return slip ? Response.json(slip) : slipNotFound();
  });
}

/*
  PATCH: logged-in users only. Sending new picks replaces the whole list, and
  the server recalculates the type and combined odds.
*/
export async function PATCH(request: Request, context: RouteContext<"/api/betslips/[id]">) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const body = await parseJsonBody(request, updateBetSlipRule);
    if (!body.ok) return body.response;

    try {
      const slip = await updateBetSlip(user.id, id, body.data);
      return slip ? Response.json(slip) : slipNotFound();
    } catch (error) {
      if (error instanceof SlipNameTakenError) {
        return apiError("conflict", error.message, 409, { name: error.message });
      }
      throw error;
    }
  });
}

/* DELETE: logged-in users only. Answers { "deleted": true, "id": "<id>" }. */
export async function DELETE(_request: Request, context: RouteContext<"/api/betslips/[id]">) {
  return withUser(async (user) => {
    const { id } = await context.params;
    const deleted = await deleteBetSlip(user.id, id);
    return deleted ? Response.json({ deleted: true, id }) : slipNotFound();
  });
}
