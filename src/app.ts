/**
 * Application composition. `buildApp()` is a factory so tests (and hot reload)
 * get a fresh instance with fresh rate-limit state.
 *
 * Middleware order: security headers → CORS → HTTP logging → global rate limit
 * → error handler → docs → routes.
 */

import { Elysia } from "elysia";
import { openapi } from "@elysiajs/openapi";
import { wrap } from "@bogeychan/elysia-logger";
import { helmetPlugin, corsPlugin, normalRateLimit } from "./middleware/security";
import { authRoutes } from "./modules/auth/auth.route";
import { keyboxRoutes } from "./modules/keybox/keybox.route";
import { usersRoutes } from "./modules/users/users.route";
import { AppError, errorBody, successBody } from "./utils/errors";
import { logger } from "./utils/logger";
import { isProduction } from "./config/env";

export function buildApp() {
  // OpenAPI exposes the full API structure; disable it in production so it is
  // not an information-disclosure surface. A no-op plugin keeps the chain intact.
  const docsPlugin = isProduction()
    ? new Elysia({ name: "keybox/docs-disabled" })
    : openapi({
        documentation: {
          info: {
            title: "Keybox API",
            version: "1.0.0",
            description:
              "Keybox is currently designed specifically for securely storing AI provider API keys.",
          },
          tags: [
            { name: "Auth", description: "Authentication" },
            { name: "Keybox", description: "Encrypted AI API key storage" },
            { name: "Users", description: "User management (CRUD)" },
          ],
          components: {
            securitySchemes: {
              bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
            },
          },
        },
      });

  return new Elysia()
    .use(helmetPlugin)
    .use(corsPlugin)
    .use(wrap(logger, { autoLogging: true }))
    .use(normalRateLimit())
    // Global, safe error handler — never leaks internals.
    .onError(({ code, error, set }) => {
      if (error instanceof AppError) {
        if (error.code === "RATE_LIMITED") {
          logger.warn({ event: "ratelimit.triggered" }, "Rate limit triggered");
        }
        set.status = error.status;
        return errorBody(error.code, error.message);
      }

      switch (code) {
        case "VALIDATION":
          // Do NOT echo the offending value — it may contain an apiKey.
          set.status = 400;
          return errorBody("VALIDATION_ERROR", "Invalid request payload");
        case "PARSE":
          set.status = 400;
          return errorBody("VALIDATION_ERROR", "Malformed request body");
        case "NOT_FOUND":
          set.status = 404;
          return errorBody("NOT_FOUND", "Resource not found");
        default:
          logger.error(
            { err: error instanceof Error ? error.message : String(error) },
            "Unhandled error",
          );
          set.status = 500;
          return errorBody("INTERNAL_ERROR", "Internal server error");
      }
    })
    .use(docsPlugin)
    .get("/health", () => successBody({ status: "ok" }), {
      detail: { summary: "Health check", tags: ["App"] },
    })
    .use(authRoutes)
    .use(keyboxRoutes())
    .use(usersRoutes());
}

export type App = ReturnType<typeof buildApp>;
