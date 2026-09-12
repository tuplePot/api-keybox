/**
 * Keybox HTTP routes. All routes require authentication via the `auth` macro;
 * the owner identity always comes from the verified JWT (`user.id`), never from
 * the request body.
 *
 * Built as a factory so each app instance gets fresh rate-limit state.
 */

import { Elysia } from "elysia";
import { authPlugin } from "../../middleware/auth";
import { revealRateLimit } from "../../middleware/security";
import { KeyboxService } from "./keybox.service";
import { AuthService } from "../auth/auth.service";
import { Errors, successBody } from "../../utils/errors";
import {
  createKeyBodySchema,
  updateKeyBodySchema,
  idParamSchema,
  revealBodySchema,
} from "./keybox.schema";

const bearer = { security: [{ bearerAuth: [] }] };

export function keyboxRoutes() {
  return (
    new Elysia({ prefix: "/api/keybox", tags: ["Keybox"] })
      .use(authPlugin)

      // List keys (metadata only)
      .get("/", async ({ user }) => successBody(await KeyboxService.list(user.id)), {
        auth: true,
        detail: { summary: "List API keys (metadata only)", ...bearer },
      })

      // Get one key (metadata only)
      .get("/:id", async ({ user, params }) => successBody(await KeyboxService.get(user.id, params.id)), {
        auth: true,
        params: idParamSchema,
        detail: { summary: "Get one API key's metadata", ...bearer },
      })

      // Create a key
      .post(
        "/",
        async ({ user, body, status }) =>
          status(201, successBody(await KeyboxService.create(user.id, body))),
        {
          auth: true,
          body: createKeyBodySchema,
          detail: {
            summary: "Create and encrypt a new API key",
            description: "The plaintext apiKey is encrypted and never returned or stored in plaintext.",
            ...bearer,
          },
        },
      )

      // Update a key
      .patch(
        "/:id",
        async ({ user, params, body }) => {
          if (Object.keys(body).length === 0) {
            throw Errors.validation("Provide at least one field to update");
          }
          return successBody(await KeyboxService.update(user.id, params.id, body));
        },
        {
          auth: true,
          params: idParamSchema,
          body: updateKeyBodySchema,
          detail: { summary: "Update an API key (re-encrypts if apiKey changes)", ...bearer },
        },
      )

      // Delete a key
      .delete(
        "/:id",
        async ({ user, params }) => {
          await KeyboxService.remove(user.id, params.id);
          return successBody({ deleted: true });
        },
        {
          auth: true,
          params: idParamSchema,
          detail: { summary: "Delete an API key", ...bearer },
        },
      )

      // Reveal plaintext — sensitive, stricter rate limit, no-store, never logged.
      // Rate-limit plugin is applied BEFORE authPlugin so the `auth` macro's
      // typed `user` survives on the handler context.
      .use(
        new Elysia()
          .use(revealRateLimit())
          .use(authPlugin)
          .post(
            "/:id/reveal",
            // Context is annotated explicitly: the rate-limit plugin's broad
            // type erases the `auth` macro's inferred `user` in this instance.
            async ({
              user,
              params,
              body,
              set,
            }: {
              user: { id: string };
              params: { id: string };
              body: { password: string };
              set: { headers: Record<string, string | number> };
            }) => {
              // Step-up auth: re-verify the account password (argon2id) BEFORE
              // decrypting. Throws INVALID_CREDENTIALS on mismatch. The password
              // is never logged.
              await AuthService.verifyPassword(user.id, body.password);

              const value = await KeyboxService.reveal(user.id, params.id);
              // Never cache the plaintext.
              set.headers["cache-control"] = "no-store";
              set.headers["pragma"] = "no-cache";
              return successBody({ value });
            },
            {
              auth: true,
              params: idParamSchema,
              body: revealBodySchema,
              detail: {
                summary: "Reveal the plaintext API key (sensitive)",
                description:
                  "Requires the account password (step-up auth). Decrypts in memory and returns the plaintext once. Rate-limited and never logged/cached.",
                ...bearer,
              },
            },
          ),
      )
  );
}
