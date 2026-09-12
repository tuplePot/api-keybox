import type { Static } from "elysia";
import type { credentialsSchema } from "./auth.schema";

export type Credentials = Static<typeof credentialsSchema>;

export interface AuthenticatedUser {
  id: string;
  username: string;
}
