/*
  FILE: app/api/health/db/route.ts
  WHAT IT'S FOR: A test address, /api/health/db, that tells you whether the app can
  reach your MongoDB database. Visit it in a browser and you'll see a short JSON answer.
  "Health check" is the usual name for a route like this.
  WHO USES IT: You (in the browser or Postman) to check the database locally now and
  on Vercel in Section 1B. No page in the app uses it.
  WHY THIS NAME: Every folder under app becomes part of the address, so
  app/api/health/db becomes /api/health/db. Next.js requires API route files to be
  named "route", and it ends in .ts (not .tsx) because it sends back data, not a screen.
*/

// pingDatabase comes from lib/db/mongodb.ts, the one shared place that knows how to connect to MongoDB.
import { pingDatabase } from "@/lib/db/mongodb";
// logServerError from lib/logging/safeLog.ts: logs a short error line with secrets blanked out.
import { logServerError } from "@/lib/logging/safeLog";

/*
  GET: runs when someone visits /api/health/db.
  - If the database answers: status 200 ("OK") with { "status": "connected" }. It does NOT say
    which database it reached, because anyone can open this address.
  - If not: status 503 ("Service Unavailable") with a plain message. The
    details only go to the server log, since anyone can open this address.
  Security note: we never send back the real error or the connection string. Error
  details can include your cluster address. The full error goes to the server's log
  (your terminal, or Vercel's logs) where only you can see it.
*/
export async function GET() {
  try {
    // pingDatabase also gives back the database's name, but we deliberately don't send it out.
    await pingDatabase();
    return Response.json({ status: "connected" });
  } catch (error) {
    // The details (and what to check: MONGODB_URI and Atlas Network Access) go
    // only to the server log (Vercel → Logs). This route is public, so strangers
    // just get a plain message with no hints about how the app is set up.
    logServerError("Database health check failed. Check MONGODB_URI and MongoDB Atlas Network Access.", error);
    return Response.json({ status: "error", message: "The database isn't available right now." }, { status: 503 });
  }
}
