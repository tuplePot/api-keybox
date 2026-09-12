/**
 * TypeScript types for the users module, derived from the TypeBox schemas.
 */

import type { Static } from "elysia";
import type {
  createUserBodySchema,
  updateUserBodySchema,
  userMetadataSchema,
} from "./users.schema";

export type CreateUserInput = Static<typeof createUserBodySchema>;
export type UpdateUserInput = Static<typeof updateUserBodySchema>;

/** Metadata returned to clients. Never contains the password or its hash. */
export type UserMetadata = Static<typeof userMetadataSchema>;
