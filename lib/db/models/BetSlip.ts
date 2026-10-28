/*
  FILE: lib/db/models/BetSlip.ts
  WHAT IT'S FOR: The database "model" for bet slips: what a slip and its picks
  look like in MongoDB, with rules that reject bad data (a name over 50
  characters, fake odds, an unknown sportsbook). It also has toBetSlip(), which
  turns a database record into the shared BetSlip type every page and API uses.
  WHO USES IT: app/api/dev/db-test/route.ts (the Section 3 test). Later: the bet
  slip API (Section 7) and the Bet Slips pages (Section 12).
  WHY THIS NAME: Named after what it stores, with a capital letter like all
  models. It ends in .ts because it shows nothing on screen.
*/

// Keeps database code on the server only. The build fails if browser code imports it.
import "server-only";
import { model, models, Schema, type Model, type Types } from "mongoose";
// The list of leagues from config/leagues.ts, so the database only accepts leagues the app knows about.
import { LEAGUES } from "@/config/leagues";
// isValidAmericanOdds from lib/betting/parlay.ts, the same odds check the parlay math uses.
import { isValidAmericanOdds } from "@/lib/betting/parlay";
// THE shared bet slip and pick definitions from the types folder (Section 2), plus the
// lists of allowed values. Using these keeps the database in step with the rest of the app.
import {
  BET_SLIP_MAX_PICKS,
  BET_SLIP_NAME_MAX_LENGTH,
  BET_SLIP_TYPES,
  GAME_PERIODS,
  MARKET_CATEGORIES,
  PARTICIPANT_KINDS,
  PICK_REFRESH_STATUSES,
  PICK_SIDES,
  SPORTSBOOK_IDS,
  type AmericanOdds,
  type BetPick,
  type BetSlip,
  type BetSlipType,
  type PickRefresh,
  type SkippedPick,
  type SlipCopyInfo,
} from "@/types";

/*
  BetSlipRecord: what a slip looks like INSIDE the database.
  Same as the shared BetSlip, except:
  - _id and userId are MongoDB IDs (ObjectIds), not text
  - createdAt and updatedAt are real dates, not text
  toBetSlip() below converts these into the shared BetSlip.
  Each pick is stored exactly as the shared BetPick type, so a pick looks the
  same in the database, the API, and the pages.
*/
export type BetSlipRecord = {
  _id: Types.ObjectId;
  /** The owner. Every query filters by this, so users only ever see their own slips. */
  userId: Types.ObjectId;
  name: string;
  type: BetSlipType;
  /** The game an SGP slip is locked to, or null for normal slips (missing on purpose). */
  sgpGameId: string | null;
  picks: BetPick[];
  /** The combined price, or null when there are no picks (missing on purpose). */
  combinedOdds: AmericanOdds | null;
  oddsAreEstimated: boolean;
  /** Where a copied slip came from, or null for normal slips (missing on purpose). */
  copiedFrom: SlipCopyInfo | null;
  createdAt: Date;
  updatedAt: Date;
};

/*
  oddsRule: a reusable check that a number is real American odds (like -110 or +150).
  Used for each pick's odds and the slip's combined odds.
*/
const oddsRule = {
  validator: (value: number | null) =>
    value === null || isValidAmericanOdds(value),
  message: "Odds must be American odds like -110 or +150.",
};

/*
  pickSchema: the rules for ONE pick inside a slip.
  _id: false means MongoDB doesn't give each pick its own extra ID, because
  BetPick already has its own "id" field.
*/
const pickSchema = new Schema<BetPick>(
  {
    id: { type: String, required: true, maxlength: 300 },
    gameId: { type: String, required: true, maxlength: 100 },
    league: { type: String, required: true, enum: LEAGUES.map((l) => l.slug) },
    gameLabel: { type: String, required: true, maxlength: 100 },
    gameStartsAt: { type: String, required: true },
    marketKey: { type: String, required: true, maxlength: 100 },
    marketCategory: { type: String, required: true, enum: MARKET_CATEGORIES },
    marketLabel: { type: String, required: true, maxlength: 100 },
    period: { type: String, required: true, enum: GAME_PERIODS },
    // participant is a small object inside the pick: { kind, id, name }.
    participant: {
      kind: { type: String, required: true, enum: PARTICIPANT_KINDS },
      id: { type: String, default: null },
      name: { type: String, required: true, maxlength: 100 },
    },
    side: { type: String, required: true, enum: PICK_SIDES },
    line: { type: Number, default: null },
    odds: { type: Number, required: true, validate: oddsRule },
    sportsbook: { type: String, required: true, enum: SPORTSBOOK_IDS },
    label: { type: String, required: true, maxlength: 200 },
    addedAt: { type: String, required: true },
    // Only on copied picks: how the price check went. Left out (undefined) on normal picks.
    refresh: {
      type: new Schema<PickRefresh>(
        {
          status: { type: String, required: true, enum: PICK_REFRESH_STATUSES },
          previousOdds: { type: Number, required: true, validate: oddsRule },
          previousLine: { type: Number, default: null },
          previousSportsbook: { type: String, required: true, enum: SPORTSBOOK_IDS },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { _id: false },
);

/*
  copyInfoSchema: the rules for the "copied from" note on a copied slip.
*/
const copyInfoSchema = new Schema<SlipCopyInfo>(
  {
    fromName: { type: String, required: true, maxlength: BET_SLIP_NAME_MAX_LENGTH },
    sportsbook: { type: String, required: true, enum: SPORTSBOOK_IDS },
    skipped: {
      type: [
        new Schema<SkippedPick>(
          {
            label: { type: String, required: true, maxlength: 200 },
            gameLabel: { type: String, required: true, maxlength: 100 },
            reason: { type: String, required: true, maxlength: 200 },
          },
          { _id: false },
        ),
      ],
      default: [],
      validate: {
        validator: (skipped: SkippedPick[]) => skipped.length <= BET_SLIP_MAX_PICKS,
        message: `At most ${BET_SLIP_MAX_PICKS} skipped picks can be noted.`,
      },
    },
    copiedAt: { type: String, required: true, maxlength: 40 },
  },
  { _id: false },
);

/*
  betSlipSchema: the rules for a whole slip.
*/
const betSlipSchema = new Schema<BetSlipRecord>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: BET_SLIP_NAME_MAX_LENGTH,
    },
    type: { type: String, required: true, enum: BET_SLIP_TYPES },
    sgpGameId: { type: String, default: null, maxlength: 100 },
    picks: {
      type: [pickSchema],
      default: [],
      // Keeps one slip from growing huge (BET_SLIP_MAX_PICKS = 25, from types/betslip.ts).
      validate: {
        validator: (picks: BetPick[]) => picks.length <= BET_SLIP_MAX_PICKS,
        message: `A slip can have at most ${BET_SLIP_MAX_PICKS} picks.`,
      },
    },
    combinedOdds: { type: Number, default: null, validate: oddsRule },
    oddsAreEstimated: { type: Boolean, required: true, default: false },
    // null = not a copy (missing on purpose).
    copiedFrom: { type: copyInfoSchema, default: null },
  },
  { timestamps: true },
);

/*
  Indexes: like the index in the back of a book, they let MongoDB find things fast.
  1. Find a user's slips, newest first (for the Bet Slips list page).
  2. Each user's slip names must be unique. This backs up the "10-23-2026 (2)"
     naming rule: even if two slips are created at the same instant, MongoDB won't
     allow a duplicate name for the same user.
*/
betSlipSchema.index({ userId: 1, updatedAt: -1 });
betSlipSchema.index({ userId: 1, name: 1 }, { unique: true });

/*
  BetSlipModel: what the rest of the code uses to find, create, update, and delete slips.
  "models.BetSlip ??" reuses the model after Next.js reloads files while you're coding.
*/
export const BetSlipModel: Model<BetSlipRecord> =
  (models.BetSlip as Model<BetSlipRecord> | undefined) ??
  model<BetSlipRecord>("BetSlip", betSlipSchema);

/*
  toBetSlip: turns a database record into the shared BetSlip type.
  It turns IDs into text and dates into ISO text, so the result can be sent as
  JSON and used by browser components.
*/
export function toBetSlip(record: BetSlipRecord): BetSlip {
  return {
    id: record._id.toString(),
    userId: record.userId.toString(),
    name: record.name,
    type: record.type,
    sgpGameId: record.sgpGameId,
    // Copy each pick field by field into a fresh plain object (no hidden database extras).
    picks: record.picks.map((pick) => ({
      id: pick.id,
      gameId: pick.gameId,
      league: pick.league,
      gameLabel: pick.gameLabel,
      gameStartsAt: pick.gameStartsAt,
      marketKey: pick.marketKey,
      marketCategory: pick.marketCategory,
      marketLabel: pick.marketLabel,
      period: pick.period,
      participant: {
        kind: pick.participant.kind,
        id: pick.participant.id,
        name: pick.participant.name,
      },
      side: pick.side,
      line: pick.line,
      odds: pick.odds,
      sportsbook: pick.sportsbook,
      label: pick.label,
      addedAt: pick.addedAt,
      ...(pick.refresh && {
        refresh: {
          status: pick.refresh.status,
          previousOdds: pick.refresh.previousOdds,
          previousLine: pick.refresh.previousLine,
          previousSportsbook: pick.refresh.previousSportsbook,
        },
      }),
    })),
    combinedOdds: record.combinedOdds,
    oddsAreEstimated: record.oddsAreEstimated,
    copiedFrom: record.copiedFrom
      ? {
          fromName: record.copiedFrom.fromName,
          sportsbook: record.copiedFrom.sportsbook,
          skipped: record.copiedFrom.skipped.map((s) => ({ label: s.label, gameLabel: s.gameLabel, reason: s.reason })),
          copiedAt: record.copiedFrom.copiedAt,
        }
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
