/**
 * Vercel serverless entry point.
 *
 * Unlike src/index.ts (a long-running Bun server that calls .listen()), Vercel
 * invokes the default-exported Elysia app's fetch handler per request. We
 * validate env and open the (cached, idempotent) Mongoose connection at cold
 * start via top-level await so the first request already has a live DB.
 *
 * vercel.json rewrites every path to /api/index; Elysia still sees the original
 * request URL, so its routing (/health, /auth/*, /keybox/*, ...) works as-is.
 */

import { getEnv } from "../src/config/env";
import { connectDatabase } from "../src/config/database";
import { buildApp } from "../src/app";

getEnv(); // fails fast if env is misconfigured
await connectDatabase(); // reused across warm invocations (readyState guard)

export default buildApp();
