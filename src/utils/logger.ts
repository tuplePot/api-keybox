/**
 * Central Pino logger.
 *
 * Redaction is configured aggressively so that secrets can never leak through
 * structured logs, even if an object containing them is accidentally logged.
 * Automatic request-body logging is disabled elsewhere; if it is ever enabled,
 * these paths still redact the sensitive fields.
 */

import { pino } from "pino";

const isProduction = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";

/** Paths whose values must never appear in logs. */
const REDACT_PATHS = [
  "apiKey",
  "*.apiKey",
  "value",
  "*.value",
  "secret",
  "*.secret",
  "password",
  "*.password",
  "encryptedValue",
  "*.encryptedValue",
  "req.body.apiKey",
  "req.body.password",
  'req.headers.authorization',
  'req.headers.cookie',
  "res.headers['set-cookie']",
  "KEYBOX_ENCRYPTION_KEY",
  "JWT_SECRET",
];

export const logger = pino({
  level: isTest ? "silent" : process.env.LOG_LEVEL ?? (isProduction ? "info" : "debug"),
  redact: {
    paths: REDACT_PATHS,
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss", ignore: "pid,hostname" },
        },
      }),
});
