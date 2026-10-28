/*
  FILE: app/api/betslips/[id]/copy/route.ts
  WHAT IT'S FOR: Copying one bet slip.
  - POST /api/betslips/<id>/copy → makes a new slip named "Copy of <name>" for the SAME user
    and answers "201 Created" with it. No JSON body is needed.
    · picks for games that already started or finished are left out. The new slip's
      "copiedFrom" says which and why
    · every other pick gets the CURRENT price (and line) from the user's sportsbook, and
      carries a "refresh" note with the old price. A bet the book doesn't offer keeps its old
      price and says so
    · the copy becomes the user's active slip
  - 404 if the slip doesn't exist, the ID is badly formed, or it belongs to someone else (the same
    answer for all three, so nobody can find out whether another user's slip exists)
  - 401 if not logged in
  WHO USES IT: the Copy slip buttons on the slip page and the slip list (components/betslips),
  through lib/betting/slipRequests.ts. Postman can call it too.
  WHY THIS NAME: "[id]" is the slip's ID from the address, and "copy" is the action. Route files
  must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

import { apiError, withUser } from "@/lib/api/respond";
import { SlipConflictError, SlipNameTakenError } from "@/lib/db/betslips";
// copyBetSlip from lib/db/betslipCopy.ts: only ever copies the logged-in user's own slip.
import { copyBetSlip } from "@/lib/db/betslipCopy";

/* POST: logged-in users only. See the list of answers at the top of this file. */
export async function POST(_request: Request, context: RouteContext<"/api/betslips/[id]/copy">) {
  return withUser(async (user) => {
    const { id } = await context.params;
    try {
      const copy = await copyBetSlip(user, id);
      // The same "not found" answer as every other slip route: a fake ID and someone else's slip look identical.
      if (!copy) return apiError("not-found", "We couldn't find that bet slip.", 404);
      return Response.json(copy, { status: 201, headers: { Location: `/api/betslips/${copy.id}` } });
    } catch (error) {
      if (error instanceof SlipNameTakenError) {
        return apiError("conflict", error.message, 409, { name: error.message });
      }
      if (error instanceof SlipConflictError) {
        return apiError("conflict", error.message, 409, { picks: error.message });
      }
      throw error;
    }
  });
}
