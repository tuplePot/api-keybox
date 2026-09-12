/**
 * Strict environment configuration with fail-fast validation.
 *
 * Security notes:
 *  - JWT_SECRET and KEYBOX_ENCRYPTION_KEY are validated to be *separate* values.
 *  - The encryption key is decoded once here and kept only in process memory.
 *  - Missing/invalid variables abort the process before any request is served.
 *
 * This module intentionally has no dependencies on the logger so that it can be
 * imported extremely early and never leak secret values.
 */

export type NodeEnv = "development" | "test" | "production";

export interface Env {
  NODE_ENV: NodeEnv;
  PORT: number;
  /** MongoDB connection string. Sourced from DATABASE_URL (or legacy MONGODB_URI). */
  DATABASE_URL: string;
  JWT_SECRET: string;
  /** Raw configured value — never log this. */
  KEYBOX_ENCRYPTION_KEY: string;
  /** Decoded 32-byte AES-256 key material — never log this. */
  ENCRYPTION_KEY_BYTES: Uint8Array;
  CORS_ORIGIN: string[];
}

class EnvError extends Error {}

function required(name: string, value: string | undefined): string {
  if (value === undefined || value.trim() === "") {
    throw new EnvError(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Decode the AES-256 key from its configured encoding.
 * Accepts a 64-char hex string or a base64 string that decodes to 32 bytes.
 */
function decodeEncryptionKey(raw: string): Uint8Array {
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return new Uint8Array(Buffer.from(raw, "hex"));
  }

  // Fall back to base64 (standard or url-safe).
  const buf = Buffer.from(raw, "base64");
  if (buf.length === 32) {
    return new Uint8Array(buf);
  }

  throw new EnvError(
    "KEYBOX_ENCRYPTION_KEY must be a 32-byte AES-256 key encoded as hex (64 chars) or base64. " +
      "Generate one with: openssl rand -base64 32",
  );
}

function parseCorsOrigin(raw: string | undefined, nodeEnv: NodeEnv): string[] {
  const origins = (raw ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  if (origins.includes("*") && nodeEnv === "production") {
    throw new EnvError('CORS_ORIGIN must not be "*" in production.');
  }

  if (origins.length === 0) {
    if (nodeEnv === "production") {
      throw new EnvError("CORS_ORIGIN must be set to an explicit origin in production.");
    }
    return ["http://localhost:5173"];
  }

  return origins;
}

function loadEnv(): Env {
  const NODE_ENV = (process.env.NODE_ENV ?? "development") as NodeEnv;
  if (!["development", "test", "production"].includes(NODE_ENV)) {
    throw new EnvError(`NODE_ENV must be development, test, or production (got "${NODE_ENV}").`);
  }

  const portRaw = process.env.PORT ?? "3000";
  const PORT = Number(portRaw);
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
    throw new EnvError(`PORT must be a valid port number (got "${portRaw}").`);
  }

  const DATABASE_URL = required(
    "DATABASE_URL",
    process.env.DATABASE_URL ?? process.env.MONGODB_URI,
  );

  const JWT_SECRET = required("JWT_SECRET", process.env.JWT_SECRET);
  if (JWT_SECRET.length < 32) {
    throw new EnvError("JWT_SECRET must be at least 32 characters long.");
  }

  const KEYBOX_ENCRYPTION_KEY = required(
    "KEYBOX_ENCRYPTION_KEY",
    process.env.KEYBOX_ENCRYPTION_KEY,
  );

  // Mandatory separation of concerns: the auth secret must never double as the
  // data-encryption key.
  if (JWT_SECRET === KEYBOX_ENCRYPTION_KEY) {
    throw new EnvError("JWT_SECRET and KEYBOX_ENCRYPTION_KEY must be different values.");
  }

  const ENCRYPTION_KEY_BYTES = decodeEncryptionKey(KEYBOX_ENCRYPTION_KEY);

  const CORS_ORIGIN = parseCorsOrigin(process.env.CORS_ORIGIN, NODE_ENV);

  return {
    NODE_ENV,
    PORT,
    DATABASE_URL,
    JWT_SECRET,
    KEYBOX_ENCRYPTION_KEY,
    ENCRYPTION_KEY_BYTES,
    CORS_ORIGIN,
  };
}

let cached: Env | null = null;

/**
 * Validate and return the environment. Fails fast (process.exit(1)) if any
 * required variable is missing or invalid — except under NODE_ENV=test, where
 * the error is thrown so tests can assert on it.
 */
export function getEnv(): Env {
  if (cached) return cached;

  try {
    cached = loadEnv();
    return cached;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (process.env.NODE_ENV === "test") {
      throw err;
    }
    // Do not print stack traces or secret values.
    console.error(`\n[env] Invalid environment configuration:\n  ${message}\n`);
    process.exit(1);
  }
}

export const isProduction = () => getEnv().NODE_ENV === "production";
export const isTest = () => getEnv().NODE_ENV === "test";
