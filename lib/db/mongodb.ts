/*
  FILE: lib/db/mongodb.ts
  WHAT IT'S FOR: Opens the connection to your MongoDB Atlas database and reuses it.
  Opening a database connection is slow, so we open it once and share it, instead
  of reconnecting on every request.
  WHO USES IT: app/api/health/db/route.ts uses it now to test the connection. In
  later sections the user and bet slip models (Section 3), login (Section 4), and
  the bet slip API (Section 7) will use it too.
  WHY THIS NAME: It lives in lib/db ("lib" = helper code, "db" = database) and is
  named after the database it connects to. It ends in .ts (not .tsx) because it
  shows nothing on screen.
*/

// "server-only" makes the build fail if any browser code ever imports this file.
// That guarantees the connection string (which holds your database password) can't leak to the browser.
import "server-only";
// Mongoose: a popular library for talking to MongoDB from Node.js. In Section 3 we'll
// also use it to describe what a user and a bet slip look like (called "models").
import mongoose from "mongoose";

/*
  The connection we've already opened (or are opening right now), saved on
  "globalThis", a storage spot that survives for as long as the server runs.
  Why: while you're coding, Next.js reloads files every time you save. Without
  this, each reload would open a brand-new connection, and Atlas's free tier
  would hit its connection limit.
*/
const globalForMongoose = globalThis as typeof globalThis & {
  mongooseConnection?: Promise<typeof mongoose>;
};

/*
  connectToDatabase: gives back an open database connection, opening one only if needed.
  If the connection string is missing, it stops with a clear message telling you
  what to fix. The message names the setting, never its value.
*/
export async function connectToDatabase(): Promise<typeof mongoose> {
  // Both values come from .env.local while you're building (and from Vercel's dashboard once the site is live).
  const uri = process.env.MONGODB_URI;
  // MONGODB_DB picks WHICH database (backroom-vegas = live, backroom-vegas-dev = preview and local).
  // Only the live site (Vercel's "production" environment) may fall back to the live name when it is missing.
  // Anywhere else a missing name is an error, so a forgotten setting can never quietly point testing at live data.
  const dbName = process.env.MONGODB_DB ?? (process.env.VERCEL_ENV === "production" ? "backroom-vegas" : undefined);
  if (!dbName) {
    throw new Error("MONGODB_DB is missing. Set it to backroom-vegas-dev in .env.local (and in Vercel's Preview environment).");
  }

  if (!uri) {
    throw new Error(
      "MONGODB_URI is missing. Add your MongoDB connection string to .env.local (or to Vercel's Environment Variables).",
    );
  }

  // Only start a new connection if there isn't one already.
  if (!globalForMongoose.mongooseConnection) {
    globalForMongoose.mongooseConnection = mongoose.connect(uri, {
      // Which database inside the cluster to use. Atlas creates it the first time we save something.
      dbName,
      // Give up after 10 seconds instead of hanging forever if Atlas can't be reached.
      serverSelectionTimeoutMS: 10_000,
    });
  }

  try {
    return await globalForMongoose.mongooseConnection;
  } catch (error) {
    // The connection failed (wrong password, IP not allowed, etc.). Forget the failed
    // attempt so the next request tries again instead of reusing a broken connection.
    globalForMongoose.mongooseConnection = undefined;
    throw error;
  }
}

/*
  pingDatabase: connects, then sends MongoDB the tiny "ping" command, which only
  asks "are you there?" and reads or changes no data. Gives back the database name if it answered.
  Used by the database test route.
*/
export async function pingDatabase(): Promise<string> {
  const connection = await connectToDatabase();
  const db = connection.connection.db;
  if (!db) {
    throw new Error("Connected, but no database was selected.");
  }
  await db.admin().command({ ping: 1 });
  return db.databaseName;
}
