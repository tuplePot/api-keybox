/**
 * Vercel serverless entrypoint.
 *
 * `vercel.json` rewrites every path to `/api/index`. The actual server object
 * (a `{ fetch }` handler that builds the app once at cold start and opens the DB
 * connection per request) lives in `src/app.ts` as its default export, so this
 * file just re-exports it. Keeping a single instance avoids building the app —
 * and its rate-limit state — twice.
 *
 * Elysia still sees the original request URL, so its routing (/health, /auth/*,
 * /keybox/*, ...) works as-is.
 */

export { default } from "../src/app";
