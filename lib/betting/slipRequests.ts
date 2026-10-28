/*
  FILE: lib/betting/slipRequests.ts
  WHAT IT'S FOR: How the BROWSER talks to our bet slip API: create a slip,
  save its picks, rename it, copy it, delete it, and choose or clear the active slip. If the server says no, it throws
  an error with the server's friendly message, so the page can show it.
  WHO USES IT: components/betslip/BetSlipProvider.tsx and the Bet Slips pages (components/betslips).
  WHY THIS NAME: These are the requests for slips. It ends in .ts because it
  shows nothing on screen. No secrets are involved: the browser sends its login
  cookie automatically, and the server checks it.
*/

// THE shared bet slip types and the API's error shape, from the types folder.
import type { ApiErrorResponse, BetPick, BetSlip, BetSlipCreateInput } from "@/types";

/*
  SlipRequestError: a request that didn't work. message is safe to show the user.
  fieldErrors says which form box was wrong, like { name: "Slip names can be up to 50 characters." }.
*/
export class SlipRequestError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "SlipRequestError";
  }
}

/* isApiError: true if the server's answer is our standard error shape (types/api.ts). */
function isApiError(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof data.error === "object" &&
    data.error !== null &&
    "message" in data.error &&
    typeof data.error.message === "string"
  );
}

/*
  send: sends one request to our API and gives back the answer.
  The <Result> type is what our own route sends back (types/betslip.ts), so we
  trust its shape here. It comes from our server, not an outside API.
*/
async function send<Result>(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<Result> {
  let response: Response;
  try {
    // A DELETE sends no data, so it has no body (and no Content-Type).
    response = await fetch(
      path,
      body === undefined
        ? { method }
        : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch {
    throw new SlipRequestError("We couldn't reach the server. Check your connection and try again.");
  }

  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw isApiError(data)
      ? new SlipRequestError(data.error.message, data.error.fieldErrors)
      : new SlipRequestError("Your slip didn't save. Please try again.");
  }
  return data as Result;
}

/* createSlip: POST /api/betslips. Gives back the new slip. */
export function createSlip(input: BetSlipCreateInput): Promise<BetSlip> {
  return send<BetSlip>("/api/betslips", "POST", input);
}

/* saveSlipPicks: PATCH /api/betslips/<id> with the full new list of picks. */
export function saveSlipPicks(slipId: string, picks: BetPick[]): Promise<BetSlip> {
  return send<BetSlip>(`/api/betslips/${encodeURIComponent(slipId)}`, "PATCH", { picks });
}

/* renameSlip: PATCH /api/betslips/<id> with a new name. */
export function renameSlip(slipId: string, name: string): Promise<BetSlip> {
  return send<BetSlip>(`/api/betslips/${encodeURIComponent(slipId)}`, "PATCH", { name });
}

/* setActiveSlip: PUT /api/betslips/active, making this slip the one the slip bar shows. */
export function setActiveSlip(slipId: string): Promise<BetSlip> {
  return send<BetSlip>("/api/betslips/active", "PUT", { slipId });
}

/*
  copySlip: POST /api/betslips/<id>/copy. Gives back the new slip, which already carries its
  notes: which picks were skipped (copiedFrom) and each pick's price check (refresh).
  It can take a few seconds, because it looks up current odds.
*/
export function copySlip(slipId: string): Promise<BetSlip> {
  return send<BetSlip>(`/api/betslips/${encodeURIComponent(slipId)}/copy`, "POST");
}

/* deleteSlip: DELETE /api/betslips/<id>. The server also stops it being your active slip. */
export function deleteSlip(slipId: string): Promise<{ deleted: true; id: string }> {
  return send<{ deleted: true; id: string }>(`/api/betslips/${encodeURIComponent(slipId)}`, "DELETE");
}

/* clearActiveSlip: PUT /api/betslips/active with no slip (what "Done" does in SGP mode). */
export function clearActiveSlip(): Promise<null> {
  return send<null>("/api/betslips/active", "PUT", { slipId: null });
}
