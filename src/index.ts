/**
 * Server entry point. Validates env, connects to MongoDB, then starts listening.
 */

import { getEnv } from "./config/env";
import { connectDatabase } from "./config/database";
import { buildApp } from "./app";
import { logger } from "./utils/logger";

async function main() {
  const env = getEnv(); // fails fast if misconfigured

  await connectDatabase();

  const app = buildApp().listen(env.PORT);

  logger.info(
    { port: env.PORT, env: env.NODE_ENV },
    `🔐 Keybox running at http://localhost:${env.PORT} (docs: /openapi)`,
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down");
    await app.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err: err instanceof Error ? err.message : String(err) }, "Failed to start server");
  process.exit(1);
});
