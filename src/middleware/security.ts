/**
 * Security middleware: CORS, security headers (helmet), and rate limiting.
 *
 * Rate limits are read from env at construction time (not the cached Env) so
 * they can be tuned per-deployment and overridden in tests.
 */

import { cors } from "@elysiajs/cors";
import { helmet } from "elysia-helmet";
import { rateLimit } from "elysia-rate-limit";
import { getEnv, isProduction } from "../config/env";
import { Errors } from "../utils/errors";

function positiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** CORS restricted to explicit allowed origins (never "*" in production). */
export const corsPlugin = cors({
  origin: getEnv().CORS_ORIGIN,
  // Authentication uses Bearer JWT in the Authorization header, not cookies, so
  // credentialed cross-origin requests are never needed. Keeping this false
  // avoids widening the attack surface for no benefit.
  credentials: false,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

/**
 * CSP directives.
 *
 * In production the API only serves JSON and the OpenAPI docs are disabled, so a
 * strict `default-src 'none'` policy is correct. In development the Scalar docs
 * UI at /openapi loads its bundle from a CDN and runs an inline bootstrap
 * script, both of which a strict policy blocks (blank page). We relax CSP only
 * in dev so the docs render; production stays locked down.
 */
const cspDirectives: Record<string, string[]> = isProduction()
  ? {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
    }
  : {
      defaultSrc: ["'self'"],
      frameAncestors: ["'none'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https:"],
      imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
      fontSrc: ["'self'", "https:", "data:"],
      workerSrc: ["'self'", "blob:"],
    };

/** Sensible security headers for an API. */
export const helmetPlugin = helmet({
  contentSecurityPolicy: { directives: cspDirectives },
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" },
});

/** Normal per-IP rate limit applied to the whole API. */
export function normalRateLimit() {
  return rateLimit({
    max: positiveIntEnv("RATE_LIMIT_MAX", 100),
    duration: positiveIntEnv("RATE_LIMIT_WINDOW_MS", 60_000),
    errorResponse: Errors.rateLimited("Too many requests, slow down"),
    headers: true,
  });
}

/**
 * Dedicated, strict limiter for the authentication endpoints (login/register).
 * Scoped to the plugin (local) so it only applies where explicitly mounted and
 * keeps its own counter, independent of the global limiter. Defaults to
 * 10 requests/min/IP to blunt credential brute-force and username enumeration.
 */
export function authRateLimit() {
  return rateLimit({
    scoping: "scoped",
    max: positiveIntEnv("AUTH_RATE_LIMIT_MAX", 10),
    duration: positiveIntEnv("AUTH_RATE_LIMIT_WINDOW_MS", 60_000),
    errorResponse: Errors.rateLimited("Too many authentication attempts, slow down"),
    headers: true,
  });
}

/**
 * Much stricter limiter for the sensitive reveal endpoint. Scoped to the plugin
 * (local) so it only applies where explicitly mounted.
 */
export function revealRateLimit() {
  return rateLimit({
    scoping: "scoped",
    max: positiveIntEnv("REVEAL_RATE_LIMIT_MAX", 10),
    duration: positiveIntEnv("REVEAL_RATE_LIMIT_WINDOW_MS", 60_000),
    errorResponse: Errors.rateLimited("Too many reveal attempts, slow down"),
    headers: true,
  });
}
