/**
 * Authentication middleware.
 *
 * `jwtPlugin` registers the @elysiajs/jwt signer/verifier (used ONLY for
 * authentication — never for encrypting API keys).
 *
 * `authPlugin` exposes an `auth` macro. Routes opt in with `{ auth: true }` and
 * receive a typed `user` in context, resolved from the verified Bearer token.
 * The identity always comes from the verified JWT, never from the request body.
 */

import { Elysia } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { getEnv } from "../config/env";
import { errorBody } from "../utils/errors";

/** Shared JWT signer/verifier. Named so Elysia dedupes it across instances. */
export const jwtPlugin = new Elysia({ name: "keybox/jwt" }).use(
  jwt({
    name: "jwt",
    secret: getEnv().JWT_SECRET,
    exp: "7d",
  }),
);

export const authPlugin = new Elysia({ name: "keybox/auth" })
  .use(jwtPlugin)
  .macro({
    auth: {
      async resolve({ jwt, headers, status }) {
        const header = headers.authorization;
        if (!header || !header.startsWith("Bearer ")) {
          return status(
            401,
            errorBody("UNAUTHORIZED", "Missing or invalid Authorization header"),
          );
        }

        const payload = await jwt.verify(header.slice(7));
        if (!payload || typeof payload.sub !== "string") {
          return status(401, errorBody("UNAUTHORIZED", "Invalid or expired token"));
        }

        return { user: { id: payload.sub } };
      },
    },
  });
