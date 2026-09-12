/**
 * Validation schemas for authentication endpoints.
 */

import { t } from "elysia";

export const credentialsSchema = t.Object(
  {
    username: t.String({ minLength: 3, maxLength: 64 }),
    password: t.String({ minLength: 8, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export const authResponseSchema = t.Object({
  token: t.String(),
  user: t.Object({
    id: t.String(),
    username: t.String(),
  }),
});
