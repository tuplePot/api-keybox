/**
 * Authentication routes: register + login. Both issue a JWT on success.
 */

import { Elysia } from "elysia";
import { jwtPlugin } from "../../middleware/auth";
import { authRateLimit } from "../../middleware/security";
import { AuthService } from "./auth.service";
import { credentialsSchema, authResponseSchema } from "./auth.schema";
import { successBody } from "../../utils/errors";

// Generic registration response — identical whether or not the username was
// already taken, so it cannot be used as an existence oracle.
const REGISTER_MESSAGE =
  "If the username is available, your account has been created. You can now log in.";

export const authRoutes = new Elysia({ prefix: "/api/auth", tags: ["Auth"] })
  .use(jwtPlugin)
  // Dedicated strict rate limit on the auth endpoints (brute-force / enumeration).
  .use(authRateLimit())
  .post(
    "/register",
    async ({ body, status }) => {
      await AuthService.register(body);
      // Never returns a token: creation and already-exists are indistinguishable.
      return status(201, successBody({ message: REGISTER_MESSAGE }));
    },
    {
      body: credentialsSchema,
      detail: {
        summary: "Register a new user",
        description:
          "Creates an account if the username is available. Returns a generic message either way; log in to obtain a JWT.",
      },
    },
  )
  .post(
    "/login",
    async ({ body, jwt }) => {
      const user = await AuthService.verify(body);
      const token = await jwt.sign({ sub: user.id });
      return successBody({ token, user });
    },
    {
      body: credentialsSchema,
      detail: {
        summary: "Log in",
        description: "Verifies credentials and returns a JWT for the Keybox API.",
      },
    },
  );

export { authResponseSchema };
