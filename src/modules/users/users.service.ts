/**
 * Users business logic (standard CRUD administration).
 *
 * Reuses the existing {@link UserModel} from the auth module — there is a single
 * "User" collection; declaring a second model would trigger Mongoose's
 * OverwriteModelError under hot reload.
 *
 * Passwords are hashed with `Bun.password` (argon2id) on write and the
 * `passwordHash` (`select: false`) is never returned. Unlike the anonymous
 * register endpoint, this is an authenticated management surface, so duplicate
 * usernames are reported explicitly (409 USER_EXISTS).
 */

import mongoose from "mongoose";
import { UserModel, type UserDocument } from "../auth/auth.model";
import { Errors } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { CreateUserInput, UpdateUserInput, UserMetadata } from "./users.types";

type UserLean = UserDocument & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

function toMetadata(doc: UserLean): UserMetadata {
  return {
    id: doc._id.toString(),
    username: doc.username,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/** Mongo duplicate-key error (unique index violation). */
function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
}

export class UsersService {
  /** List all users (metadata only, newest first). Never returns the hash. */
  static async list(): Promise<UserMetadata[]> {
    const docs = await UserModel.find().sort({ createdAt: -1 }).lean<UserLean[]>().exec();
    return docs.map(toMetadata);
  }

  /** Get one user's metadata. */
  static async get(id: string): Promise<UserMetadata> {
    if (!mongoose.isValidObjectId(id)) throw Errors.notFound("User not found");

    const doc = await UserModel.findById(id).lean<UserLean>().exec();
    if (!doc) throw Errors.notFound("User not found");

    return toMetadata(doc);
  }

  /** Create a new user: hash the password, persist. 409 on duplicate username. */
  static async create(input: CreateUserInput): Promise<UserMetadata> {
    const username = input.username.toLowerCase();
    const passwordHash = await Bun.password.hash(input.password);

    try {
      const created = await UserModel.create({ username, passwordHash });
      logger.info({ event: "user.created", userId: created._id.toString() }, "User created");
      return toMetadata(created.toObject() as UserLean);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw Errors.userExists();
      throw err;
    }
  }

  /** Update mutable fields; re-hash only if a new password is supplied. */
  static async update(id: string, input: UpdateUserInput): Promise<UserMetadata> {
    if (!mongoose.isValidObjectId(id)) throw Errors.notFound("User not found");

    const update: Record<string, unknown> = {};
    if (input.username !== undefined) update.username = input.username.toLowerCase();
    if (input.password !== undefined) update.passwordHash = await Bun.password.hash(input.password);

    try {
      const doc = await UserModel.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      })
        .lean<UserLean>()
        .exec();

      if (!doc) throw Errors.notFound("User not found");

      logger.info({ event: "user.updated", userId: id }, "User updated");
      return toMetadata(doc);
    } catch (err) {
      if (isDuplicateKeyError(err)) throw Errors.userExists();
      throw err;
    }
  }

  /** Delete a user. 404s if it does not exist. */
  static async remove(id: string): Promise<void> {
    if (!mongoose.isValidObjectId(id)) throw Errors.notFound("User not found");

    const res = await UserModel.deleteOne({ _id: id }).exec();
    if (res.deletedCount === 0) throw Errors.notFound("User not found");

    logger.info({ event: "user.deleted", userId: id }, "User deleted");
  }
}
