/*
  FILE: app/api/betslips/route.ts
  WHAT IT'S FOR: The bet slip list, plus creating a new slip.
  - GET  /api/betslips → all of YOUR slips, newest first (JSON). This is the
    route the rubric checks: "visiting /api/betslips in the browser shows JSON."
  - POST /api/betslips → creates a slip. Send JSON like
    { "name": "Sunday picks", "picks": [ ... ] }. Everything is optional, and
    with no name it's named with today's date, like "10-23-2026". Add
    "setActive": true to make it your active slip (the slip bar shows it).
    Picks that can't go together get "409 conflict".
  WHO USES IT: Postman tests now. Later: the Bet Slips list page (Section 12)
  and the odds buttons that auto-create a slip on your first pick (Section 8).
  WHY THIS NAME: The folders app/api/betslips become /api/betslips. Route files
  must be named "route", and it ends in .ts because it sends back data, not a screen.
*/

// The shared route helpers from lib/api/respond.ts: login check, error shape, and body checking.
import { apiError, parseJsonBody, withUser } from "@/lib/api/respond";
// The rules for a new slip, from lib/betting/validation.ts.
import { createBetSlipRule } from "@/lib/betting/validation";
// The bet slip database code from lib/db/betslips.ts. It only ever touches the logged-in user's slips.
import { createBetSlip, listBetSlips, SlipConflictError, SlipNameTakenError } from "@/lib/db/betslips";

/* GET: logged-in users only. Returns [] (an empty list) if you have no slips yet. */
export async function GET() {
  return withUser(async (user) => Response.json(await listBetSlips(user.id)));
}

/*
  POST: logged-in users only. Answers "201 Created" with the new slip.
  Any type or combinedOdds the browser sends is ignored. The server works them out.
*/
export async function POST(request: Request) {
  return withUser(async (user) => {
    const body = await parseJsonBody(request, createBetSlipRule);
    if (!body.ok) return body.response;

    try {
      const slip = await createBetSlip(user.id, body.data);
      // Location: the address of the new slip, a standard part of a "201 Created" answer.
      return Response.json(slip, { status: 201, headers: { Location: `/api/betslips/${slip.id}` } });
    } catch (error) {
      if (error instanceof SlipNameTakenError) {
        return apiError("conflict", error.message, 409, { name: error.message });
      }
      // Picks that can't go together (the same message the conflict popup shows).
      if (error instanceof SlipConflictError) {
        return apiError("conflict", error.message, 409, { picks: error.message });
      }
      throw error;
    }
  });
}
