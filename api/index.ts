/**
 * Vercel serverless entrypoint.
 *
 * Vercel's Bun runtime requires the default export to be a function or a
 * `{ fetch }` server object — NOT a raw Elysia instance. So we build the app
 * once (cold start) and expose Elysia's Fetch handler via `app.handle`.
 *
 * The DB connection is opened per request (idempotent — connectDatabase guards
 * on readyState), which is the serverless-friendly pattern: the connection is
 * reused across warm invocations and re-established after a cold start.
 *
 * vercel.json rewrites every path here; Elysia still sees the original request
 * URL, so its routing (/health, /auth/*, /keybox/*, ...) works as-is.
 */

import { getEnv } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { buildApp } from "../src/app";

getEnv(); // fails fast if env is misconfigured
const app = buildApp();

export default {
  async fetch(request: Request) {
    await connectDatabase();
    return app.handle(request);
  },
};
