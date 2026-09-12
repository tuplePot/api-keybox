/**
 * Keybox encryption module — AES-256-GCM authenticated encryption via the
 * Web Crypto API (available natively in Bun).
 *
 * Guarantees:
 *  - A fresh, cryptographically random 96-bit IV is generated for EVERY
 *    encryption operation (IVs are never reused with the same key).
 *  - The GCM authentication tag is included in the ciphertext, so tampering is
 *    detected on decrypt (decryption throws).
 *  - The payload is versioned so the scheme can be migrated later.
 *  - Plaintext is never logged and never persisted.
 *
 * Persisted payload shape (all binary fields are base64):
 *   { version: 1, algorithm: "AES-256-GCM", iv: "...", ciphertext: "..." }
 */

import { getEnv, isTest } from "../../config/env";

export const ENCRYPTION_VERSION = 1 as const;
export const ENCRYPTION_ALGORITHM = "AES-256-GCM" as const;

/** 96-bit IV is the recommended nonce size for AES-GCM. */
const IV_LENGTH_BYTES = 12;

export interface EncryptedSecret {
  version: number;
  algorithm: string;
  /** base64-encoded initialization vector */
  iv: string;
  /** base64-encoded ciphertext with the GCM auth tag appended */
  ciphertext: string;
}

/** Thrown for any decrypt/parse failure. Message is intentionally generic. */
export class DecryptionError extends Error {
  constructor(message = "Failed to decrypt secret") {
    super(message);
    this.name = "DecryptionError";
  }
}

let cryptoKeyPromise: Promise<CryptoKey> | null = null;

/** Import (and cache) the AES-256-GCM key from validated env key material. */
function getKey(): Promise<CryptoKey> {
  if (!cryptoKeyPromise) {
    const bytes = getEnv().ENCRYPTION_KEY_BYTES;
    // A 32-byte key => AES-256.
    cryptoKeyPromise = crypto.subtle.importKey(
      "raw",
      bytes as BufferSource,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }
  return cryptoKeyPromise;
}

function toBase64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return Buffer.from(view).toString("base64");
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64"));
}

/**
 * Encrypt a plaintext secret. Rejects empty input.
 */
export async function encryptSecret(value: string): Promise<EncryptedSecret> {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("Cannot encrypt an empty value");
  }

  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH_BYTES));
  const plaintext = new TextEncoder().encode(value);

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    plaintext as BufferSource,
  );

  return {
    version: ENCRYPTION_VERSION,
    algorithm: ENCRYPTION_ALGORITHM,
    iv: toBase64(iv),
    ciphertext: toBase64(ciphertext),
  };
}

function assertValidPayload(payload: unknown): asserts payload is EncryptedSecret {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as EncryptedSecret).iv !== "string" ||
    typeof (payload as EncryptedSecret).ciphertext !== "string" ||
    (payload as EncryptedSecret).iv.length === 0 ||
    (payload as EncryptedSecret).ciphertext.length === 0
  ) {
    throw new DecryptionError("Malformed encrypted payload");
  }

  const version = (payload as EncryptedSecret).version;
  if (version !== ENCRYPTION_VERSION) {
    throw new DecryptionError(`Unsupported encryption version: ${String(version)}`);
  }
}

/**
 * Decrypt a stored payload back to plaintext. Throws {@link DecryptionError}
 * for tampered ciphertext, malformed payloads, or unsupported versions.
 */
export async function decryptSecret(payload: EncryptedSecret): Promise<string> {
  assertValidPayload(payload);

  const key = await getKey();
  const iv = fromBase64(payload.iv);
  const ciphertext = fromBase64(payload.ciphertext);

  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    );
    return new TextDecoder().decode(plaintext);
  } catch {
    // GCM tag mismatch (tampering) or any other failure — never leak details.
    throw new DecryptionError();
  }
}

/**
 * Test-only helper to reset the cached key (e.g. after swapping env). Guarded so
 * production code can never invoke it and accidentally trigger a decrypt failure
 * by forcing a re-read of the env key.
 */
export function __resetKeyCacheForTests(): void {
  if (!isTest()) {
    throw new Error("__resetKeyCacheForTests may only be called under NODE_ENV=test");
  }
  cryptoKeyPromise = null;
}
