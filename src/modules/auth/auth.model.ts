/**
 * Minimal user model for authentication only.
 *
 * Passwords are hashed with Bun's built-in `Bun.password` (argon2id) — no extra
 * dependency required. The plaintext password is never stored.
 */

import { Schema, model, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    /** argon2id hash — never the plaintext password. */
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

export const UserModel: Model<UserDocument> =
  (globalThis as Record<string, unknown>).__UserModel as Model<UserDocument> ??
  model<UserDocument>("User", userSchema);

(globalThis as Record<string, unknown>).__UserModel = UserModel;
