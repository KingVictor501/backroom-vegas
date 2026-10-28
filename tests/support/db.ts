/*
  FILE: tests/support/db.ts
  WHAT IT'S FOR: Shortcuts that tests use to set up the throwaway database:
  - resetDatabase(): wipes users and bet slips and logs everyone out, so every
    test starts from a clean slate
  - createTestUser(): adds a user with a known password
  - logInAs(): "logs in" as a user by putting a real signed bv_session cookie in the pretend jar
  - logOut(): empties the jar
  WHO USES IT: the test files in tests/ and lib/.
  WHY THIS NAME: It's the database helper for tests. It ends in .ts because it shows nothing on screen.
*/

import bcrypt from "bcryptjs";
// The real database connection and models. In tests they connect to the in-memory database (see setup.ts).
import { connectToDatabase } from "@/lib/db/mongodb";
import { BetSlipModel } from "@/lib/db/models/BetSlip";
import { UserModel } from "@/lib/db/models/User";
// The real token maker and cookie name, so a test login is built exactly like a real one.
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/token";
import { cookieJar } from "./cookies";

/* TestUser: what createTestUser gives back. The password is here so the test can type it into a login. */
export type TestUser = { id: string; email: string; password: string };

/*
  resetDatabase: connects, makes sure the database's "unique" rules (one email
  per user, one slip name per user) are really in place, then empties both
  collections. Call it in beforeEach.
*/
export async function resetDatabase(): Promise<void> {
  await connectToDatabase();
  // init() waits until the unique rules are built, so tests about duplicates are reliable.
  await Promise.all([UserModel.init(), BetSlipModel.init()]);
  await Promise.all([UserModel.deleteMany({}), BetSlipModel.deleteMany({})]);
  cookieJar.clear();
}

/*
  createTestUser: saves a user straight into the database.
  The password is hashed with bcrypt at a LOW cost (4) only to keep tests fast.
  The real app uses cost 12, and the sign up test checks that one.
*/
export async function createTestUser(email: string, password = "Password1"): Promise<TestUser> {
  await connectToDatabase();
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await UserModel.create({ email, passwordHash });
  return { id: user._id.toString(), email, password };
}

/* logInAs: the pretend browser now holds a valid login cookie for this user. */
export async function logInAs(user: Pick<TestUser, "id">): Promise<void> {
  cookieJar.set(SESSION_COOKIE_NAME, await createSessionToken(user.id));
}

/* logOut: the pretend browser holds no cookies. */
export function logOut(): void {
  cookieJar.clear();
}
