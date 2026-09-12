/**
 * Authentication business logic: register + verify credentials.
 *
 * JWT signing/verification lives in the auth route/middleware (it depends on the
 * Elysia jwt plugin). This service is transport-agnostic and only concerns
 * itself with the user store and password hashing.
 */

import { UserModel } from "./auth.model";
import { Errors } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { AuthenticatedUser, Credentials } from "./auth.types";

export class AuthService {
  /**
   * Register a new user. To avoid leaking whether a username already exists,
   * this NEVER reports "already taken": it silently creates the account only if
   * the username is free, and otherwise returns without error. The route
   * responds with the same generic message either way.
   *
   * The password is hashed on BOTH paths so the response timing does not reveal
   * existence (creation is the expensive argon2id step).
   */
  static async register(input: Credentials): Promise<void> {
    const username = input.username.toLowerCase();

    // Compute the hash unconditionally to equalize timing between the
    // "created" and "already-exists" paths.
    const passwordHash = await Bun.password.hash(input.password);

    const existing = await UserModel.exists({ username });
    if (existing) {
      // Do nothing and do not reveal existence. Log without the username so the
      // logs are not an enumeration oracle either.
      logger.info({ event: "auth.register.duplicate" }, "Registration for existing username");
      return;
    }

    const user = await UserModel.create({ username, passwordHash });

    logger.info({ event: "auth.registered", userId: user._id.toString() }, "User registered");
  }

  /**
   * Verify a user's password by id. Used for step-up authentication (e.g. the
   * reveal endpoint). Throws INVALID_CREDENTIALS on any failure. Never logs the
   * password.
   */
  static async verifyPassword(userId: string, password: string): Promise<void> {
    const user = await UserModel.findById(userId).select("+passwordHash").exec();

    if (!user) {
      // Equalize timing even when the user id resolves to nothing.
      await Bun.password.verify(password, await DUMMY_HASH).catch(() => false);
      throw Errors.invalidCredentials();
    }

    const ok = await Bun.password.verify(password, user.passwordHash);
    if (!ok) throw Errors.invalidCredentials();
  }

  /**
   * Verify credentials. Returns the user on success, throws INVALID_CREDENTIALS
   * on failure. The same generic error is used for unknown-user and bad-password
   * so we don't reveal which usernames exist.
   */
  static async verify(input: Credentials): Promise<AuthenticatedUser> {
    const username = input.username.toLowerCase();
    const user = await UserModel.findOne({ username }).select("+passwordHash").exec();

    if (!user) {
      // Run a dummy verify to reduce username-enumeration via timing.
      await Bun.password.verify(input.password, await DUMMY_HASH).catch(() => false);
      logger.warn({ event: "auth.failure", username }, "Authentication failure");
      throw Errors.invalidCredentials();
    }

    const ok = await Bun.password.verify(input.password, user.passwordHash);
    if (!ok) {
      logger.warn({ event: "auth.failure", userId: user._id.toString() }, "Authentication failure");
      throw Errors.invalidCredentials();
    }

    return { id: user._id.toString(), username };
  }
}

// A REAL argon2id hash of a random throwaway string, computed once at module
// initialization. Used only to equalize verify timing for unknown usernames so
// a fabricated (potentially fast-rejecting) hash cannot leak existence. Kept as
// a promise to avoid top-level await; awaited at each use.
const DUMMY_HASH: Promise<string> = Bun.password.hash(
  `dummy-timing-value-${crypto.randomUUID()}`,
);
