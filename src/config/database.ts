/**
 * MongoDB connection management via Mongoose.
 */

import dns from "node:dns";
import mongoose from "mongoose";
import { getEnv, isProduction } from "./env";
import { logger } from "../utils/logger";

// Some local/ISP resolvers (and Bun on Windows) refuse the SRV queries used by
// mongodb+srv:// URIs. Overriding DNS is opt-in only — set DNS_SERVERS to a
// comma-separated list (e.g. "8.8.8.8,1.1.1.1") to force public resolvers. When
// unset, the OS/corporate DNS configuration is left untouched.
const dnsServers = (process.env.DNS_SERVERS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (dnsServers.length > 0) {
  dns.setServers(dnsServers);
}

mongoose.set("strictQuery", true);

/** Connect to MongoDB. Defaults to the configured DATABASE_URL. */
export async function connectDatabase(uri: string = getEnv().DATABASE_URL): Promise<void> {
  if (mongoose.connection.readyState === 1) return;

  const options: mongoose.ConnectOptions = {
    serverSelectionTimeoutMS: 10_000,
  };

  // Enforce TLS in production so data in transit is never plaintext. Atlas
  // (mongodb+srv://) already negotiates TLS; this makes it mandatory for any
  // self-hosted deployment too and fails fast if the server is not secured.
  if (isProduction()) {
    options.tls = true;
  }

  await mongoose.connect(uri, options);

  // Never log the connection string (it may contain credentials).
  logger.info({ host: mongoose.connection.host }, "MongoDB connected");
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
}

export { mongoose };
