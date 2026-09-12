/**
 * Users HTTP routes — standard CRUD (list / get / create / update / delete).
 *
 * All routes require authentication via the `auth` macro. This app has no role
 * model, so any authenticated user may manage users; add authorization here if
 * an admin concept is introduced. Responses carry metadata only — never the
 * password hash.
 *
 * Built as a factory so each app instance gets fresh rate-limit state.
 */

import { Elysia } from "elysia";
import { authPlugin } from "../../middleware/auth";
import { UsersService } from "./users.service";
import { Errors, successBody } from "../../utils/errors";
import { createUserBodySchema, updateUserBodySchema, idParamSchema } from "./users.schema";

const bearer = { security: [{ bearerAuth: [] }] };

export function usersRoutes() {
  return (
    new Elysia({ prefix: "/api/users", tags: ["Users"] })
      .use(authPlugin)

      // List users (metadata only)
      .get("/", async () => successBody(await UsersService.list()), {
        auth: true,
        detail: { summary: "List users", ...bearer },
      })

      // Get one user (metadata only)
      .get("/:id", async ({ params }) => successBody(await UsersService.get(params.id)), {
        auth: true,
        params: idParamSchema,
        detail: { summary: "Get one user", ...bearer },
      })

      // Create a user
      .post(
        "/",
        async ({ body, status }) => status(201, successBody(await UsersService.create(body))),
        {
          auth: true,
          body: createUserBodySchema,
          detail: {
            summary: "Create a user",
            description: "Hashes the password (argon2id). The password is never returned.",
            ...bearer,
          },
        },
      )

      // Update a user
      .patch(
        "/:id",
        async ({ params, body }) => {
          if (Object.keys(body).length === 0) {
            throw Errors.validation("Provide at least one field to update");
          }
          return successBody(await UsersService.update(params.id, body));
        },
        {
          auth: true,
          params: idParamSchema,
          body: updateUserBodySchema,
          detail: { summary: "Update a user (re-hashes if password changes)", ...bearer },
        },
      )

      // Delete a user
      .delete(
        "/:id",
        async ({ params }) => {
          await UsersService.remove(params.id);
          return successBody({ deleted: true });
        },
        {
          auth: true,
          params: idParamSchema,
          detail: { summary: "Delete a user", ...bearer },
        },
      )
  );
}
