/**
 * Keybox business logic.
 *
 * Ownership rule: every operation is scoped by `owner` (the authenticated user
 * id from the verified JWT). Keys belonging to other owners are treated as
 * non-existent (404), so we never leak their existence.
 *
 * Decryption happens ONLY in {@link KeyboxService.reveal}. List/detail return a
 * precomputed masked value and never touch the ciphertext.
 */

import mongoose from "mongoose";
import { KeyboxModel, type KeyboxDocument } from "./keybox.model";
import { PROVIDER_CONSOLE_URLS, type AiProvider } from "./keybox.schema";
import { encryptSecret, decryptSecret } from "./keybox.crypto";
import { maskSecret } from "../../utils/mask";
import { Errors } from "../../utils/errors";
import { logger } from "../../utils/logger";
import type { CreateKeyInput, UpdateKeyInput, KeyMetadata } from "./keybox.types";

type KeyboxLean = KeyboxDocument & { _id: mongoose.Types.ObjectId };

function toMetadata(doc: KeyboxLean): KeyMetadata {
  return {
    id: doc._id.toString(),
    name: doc.name,
    provider: doc.provider,
    maskedValue: doc.maskedValue,
    description: doc.description ?? null,
    accountLabel: doc.accountLabel ?? null,
    // Fall back to the provider's default console link so the UI always has a
    // one-click destination, even for keys saved without a custom URL.
    consoleUrl: doc.consoleUrl ?? PROVIDER_CONSOLE_URLS[doc.provider as AiProvider] ?? null,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  };
}

export class KeyboxService {
  /** List a user's keys (metadata only, newest first). Never decrypts. */
  static async list(owner: string): Promise<KeyMetadata[]> {
    const docs = await KeyboxModel.find({ owner })
      .sort({ createdAt: -1 })
      .lean<KeyboxLean[]>()
      .exec();
    return docs.map(toMetadata);
  }

  /** Get one key's metadata. Never decrypts. */
  static async get(owner: string, id: string): Promise<KeyMetadata> {
    if (!mongoose.isValidObjectId(id)) throw Errors.keyNotFound();

    const doc = await KeyboxModel.findOne({ _id: id, owner }).lean<KeyboxLean>().exec();
    if (!doc) throw Errors.keyNotFound();

    return toMetadata(doc);
  }

  /** Create a new key: encrypt, precompute mask, persist. */
  static async create(owner: string, input: CreateKeyInput): Promise<KeyMetadata> {
    const encryptedValue = await encryptSecret(input.apiKey);
    const maskedValue = maskSecret(input.apiKey);

    const created = await KeyboxModel.create({
      owner,
      name: input.name,
      provider: input.provider,
      encryptedValue,
      maskedValue,
      description: input.description,
      accountLabel: input.accountLabel,
      consoleUrl: input.consoleUrl,
    });

    logger.info({ event: "key.created", owner, keyId: created._id.toString() }, "Key created");

    return toMetadata(created.toObject() as KeyboxLean);
  }

  /**
   * Reveal a key's plaintext. This is the ONLY method that decrypts.
   * The caller must ensure this response is neither logged nor cached.
   */
  static async reveal(owner: string, id: string): Promise<string> {
    if (!mongoose.isValidObjectId(id)) throw Errors.keyNotFound();

    // Explicitly select the otherwise-hidden encryptedValue.
    const doc = await KeyboxModel.findOne({ _id: id, owner })
      .select("+encryptedValue")
      .lean<KeyboxLean>()
      .exec();
    if (!doc || !doc.encryptedValue) throw Errors.keyNotFound();

    const value = await decryptSecret(doc.encryptedValue);

    // Log the event WITHOUT the plaintext.
    logger.info({ event: "key.revealed", owner, keyId: id }, "Key revealed");

    return value;
  }

  /** Update mutable fields; re-encrypt only if a new apiKey is supplied. */
  static async update(owner: string, id: string, input: UpdateKeyInput): Promise<KeyMetadata> {
    if (!mongoose.isValidObjectId(id)) throw Errors.keyNotFound();

    const update: Record<string, unknown> = {};
    if (input.name !== undefined) update.name = input.name;
    if (input.provider !== undefined) update.provider = input.provider;
    if (input.description !== undefined) update.description = input.description;
    if (input.accountLabel !== undefined) update.accountLabel = input.accountLabel;
    if (input.consoleUrl !== undefined) update.consoleUrl = input.consoleUrl;

    if (input.apiKey !== undefined) {
      update.encryptedValue = await encryptSecret(input.apiKey);
      update.maskedValue = maskSecret(input.apiKey);
    }

    const doc = await KeyboxModel.findOneAndUpdate({ _id: id, owner }, update, {
      new: true,
      runValidators: true,
    })
      .lean<KeyboxLean>()
      .exec();

    if (!doc) throw Errors.keyNotFound();

    logger.info({ event: "key.updated", owner, keyId: id }, "Key updated");

    return toMetadata(doc);
  }

  /** Delete a key. Idempotently 404s if it does not exist for this owner. */
  static async remove(owner: string, id: string): Promise<void> {
    if (!mongoose.isValidObjectId(id)) throw Errors.keyNotFound();

    const res = await KeyboxModel.deleteOne({ _id: id, owner }).exec();
    if (res.deletedCount === 0) throw Errors.keyNotFound();

    logger.info({ event: "key.deleted", owner, keyId: id }, "Key deleted");
  }
}
