/**
 * TypeBox validation schemas for the users module (standard CRUD).
 *
 * All request bodies are validated on the backend. Unknown/unexpected fields
 * are rejected by TypeBox's default `additionalProperties: false`. The password
 * is accepted on write but NEVER echoed back — responses carry metadata only.
 */

import { t } from "elysia";

const usernameSchema = t.String({ minLength: 3, maxLength: 64, examples: ["alice"] });
// Example value is intentionally fake — never document real credentials.
const passwordSchema = t.String({ minLength: 8, maxLength: 200, examples: ["change-me-please"] });

/** Mongo ObjectId as a 24-char hex string. */
export const idParamSchema = t.Object({
  id: t.String({ pattern: "^[a-fA-F0-9]{24}$", error: "Invalid id" }),
});

export const createUserBodySchema = t.Object(
  {
    username: usernameSchema,
    password: passwordSchema,
  },
  { additionalProperties: false },
);

export const updateUserBodySchema = t.Object(
  {
    username: t.Optional(usernameSchema),
    password: t.Optional(passwordSchema),
  },
  { additionalProperties: false },
);

/** Response DTO — metadata only. Never includes the password or its hash. */
export const userMetadataSchema = t.Object({
  id: t.String(),
  username: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
});
