/**
 * TypeScript types for the keybox module, derived from the TypeBox schemas.
 */

import type { Static } from "elysia";
import type {
  createKeyBodySchema,
  updateKeyBodySchema,
  keyMetadataSchema,
} from "./keybox.schema";

export type CreateKeyInput = Static<typeof createKeyBodySchema>;
export type UpdateKeyInput = Static<typeof updateKeyBodySchema>;

/** Metadata returned to clients. Never contains plaintext or ciphertext. */
export type KeyMetadata = Static<typeof keyMetadataSchema>;

/** Authenticated identity extracted from the verified JWT. */
export interface AuthUser {
  id: string;
}
