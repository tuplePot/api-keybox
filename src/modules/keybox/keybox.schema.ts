/**
 * TypeBox validation schemas and shared constants for the keybox module.
 *
 * All request bodies are validated on the backend. Unknown/unexpected fields
 * are rejected by TypeBox's default `additionalProperties: false`.
 */

import { t } from "elysia";

/**
 * Supported AI providers for the MVP. The provider is validated against this
 * list, but no provider-specific API-key *format* is enforced (providers change
 * their formats over time).
 */
export const AI_PROVIDERS = [
  "OpenAI",
  "Google Gemini",
  "xAI / Grok",
  "Alibaba / Qwen",
  "Anthropic / Claude",
  "DeepSeek",
  "Other",
] as const;

export type AiProvider = (typeof AI_PROVIDERS)[number];

/**
 * Default "manage / console" URL for each provider. Used as a fallback link so
 * the UI can offer a one-click jump to where the key is managed, even when the
 * user didn't supply a custom `consoleUrl`. These are public dashboard URLs, not
 * secrets. "Other" has no default.
 */
export const PROVIDER_CONSOLE_URLS: Record<AiProvider, string | null> = {
  OpenAI: "https://platform.openai.com/api-keys",
  "Google Gemini": "https://aistudio.google.com/app/apikey",
  "xAI / Grok": "https://console.x.ai/",
  "Alibaba / Qwen": "https://dashscope.console.aliyun.com/apiKey",
  "Anthropic / Claude": "https://console.anthropic.com/settings/keys",
  DeepSeek: "https://platform.deepseek.com/api_keys",
  Other: null,
};

const providerSchema = t.Union(
  AI_PROVIDERS.map((p) => t.Literal(p)),
  { error: "provider must be one of the supported AI providers" },
);

const nameSchema = t.String({ minLength: 1, maxLength: 120, examples: ["Gemini Development"] });
// Example value is intentionally fake — never document real credentials.
const apiKeySchema = t.String({ minLength: 1, maxLength: 8192, examples: ["sk-example-not-real"] });
const descriptionSchema = t.Optional(t.String({ maxLength: 500, examples: ["Development key"] }));
/** Which account this key belongs to (e.g. an email or account label). Not a secret. */
const accountLabelSchema = t.Optional(
  t.String({ minLength: 1, maxLength: 200, examples: ["personal@gmail.com"] }),
);
/** Link to the provider's console/dashboard. Must be an http(s) URL. */
const consoleUrlSchema = t.Optional(
  t.String({
    maxLength: 2048,
    pattern: "^https?://.+",
    error: "consoleUrl must be an http(s) URL",
    examples: ["https://console.x.ai/"],
  }),
);

/** Mongo ObjectId as a 24-char hex string. */
export const idParamSchema = t.Object({
  id: t.String({ pattern: "^[a-fA-F0-9]{24}$", error: "Invalid id" }),
});

export const createKeyBodySchema = t.Object(
  {
    name: nameSchema,
    provider: providerSchema,
    apiKey: apiKeySchema,
    description: descriptionSchema,
    accountLabel: accountLabelSchema,
    consoleUrl: consoleUrlSchema,
  },
  { additionalProperties: false },
);

export const updateKeyBodySchema = t.Object(
  {
    name: t.Optional(nameSchema),
    provider: t.Optional(providerSchema),
    apiKey: t.Optional(apiKeySchema),
    description: descriptionSchema,
    accountLabel: accountLabelSchema,
    consoleUrl: consoleUrlSchema,
  },
  { additionalProperties: false },
);

/** Response DTO — metadata only. Never includes the plaintext or ciphertext. */
export const keyMetadataSchema = t.Object({
  id: t.String(),
  name: t.String(),
  provider: t.String(),
  maskedValue: t.String(),
  description: t.Optional(t.Union([t.String(), t.Null()])),
  accountLabel: t.Optional(t.Union([t.String(), t.Null()])),
  consoleUrl: t.Optional(t.Union([t.String(), t.Null()])),
  createdAt: t.String(),
  updatedAt: t.String(),
});

/**
 * Step-up authentication body for the reveal endpoint: the caller must
 * re-enter their account password. Verified with argon2id before any decrypt.
 */
export const revealBodySchema = t.Object(
  {
    password: t.String({ minLength: 1, maxLength: 200 }),
  },
  { additionalProperties: false },
);

export const revealResponseSchema = t.Object({
  value: t.String(),
});
