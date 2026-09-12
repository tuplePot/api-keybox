/**
 * Mongoose model for a stored AI provider API key.
 *
 * Security invariants:
 *  - There is NO plaintext `apiKey` field. Only `encryptedValue` is persisted.
 *  - `encryptedValue` uses `select: false` so it is excluded from queries by
 *    default; the reveal path must opt in explicitly. This prevents accidental
 *    exposure through list/detail queries.
 *  - `maskedValue` is a safe display hint computed at write time, so list/detail
 *    responses never need to decrypt anything.
 *  - The encryption key itself is NEVER stored here.
 */

import { Schema, model, type InferSchemaType, type Model } from "mongoose";
import { AI_PROVIDERS } from "./keybox.schema";

const encryptedValueSchema = new Schema(
  {
    version: { type: Number, required: true },
    algorithm: { type: String, required: true },
    iv: { type: String, required: true },
    ciphertext: { type: String, required: true },
  },
  { _id: false },
);

const keyboxSchema = new Schema(
  {
    /** Owner identity — comes from the verified JWT, never from the client body. */
    owner: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    provider: { type: String, required: true, enum: AI_PROVIDERS },
    /** Excluded from queries by default; only the reveal path selects it. */
    encryptedValue: { type: encryptedValueSchema, required: true, select: false },
    /** Safe, precomputed masked display value (e.g. "AIza••••••••91KD"). */
    maskedValue: { type: String, required: true },
    description: { type: String, maxlength: 500 },
    /** Which account this key belongs to (e.g. an email or label). Not a secret. */
    accountLabel: { type: String, trim: true, maxlength: 200 },
    /** Link to the provider's console/dashboard for quick access. Not a secret. */
    consoleUrl: { type: String, trim: true, maxlength: 2048 },
  },
  { timestamps: true },
);

// Efficient per-owner listing, newest first.
keyboxSchema.index({ owner: 1, createdAt: -1 });

export type KeyboxDocument = InferSchemaType<typeof keyboxSchema>;

export const KeyboxModel: Model<KeyboxDocument> =
  (globalThis as Record<string, unknown>).__KeyboxModel as Model<KeyboxDocument> ??
  model<KeyboxDocument>("Keybox", keyboxSchema);

// Avoid OverwriteModelError under Bun's watch/hot-reload during development.
(globalThis as Record<string, unknown>).__KeyboxModel = KeyboxModel;
