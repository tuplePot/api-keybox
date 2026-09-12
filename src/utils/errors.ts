/**
 * Consistent, safe API errors.
 *
 * Errors are represented by {@link AppError} which carries an HTTP status, a
 * stable machine-readable `code`, and a human-safe `message`. The global error
 * handler (see app.ts) converts everything else into a generic INTERNAL_ERROR
 * so we never leak stack traces, DB internals, crypto details, env values, or
 * plaintext secrets to clients.
 */

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "INVALID_CREDENTIALS"
  | "USER_EXISTS"
  | "KEY_NOT_FOUND"
  | "RATE_LIMITED"
  | "NOT_FOUND"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
  }
}

export const Errors = {
  validation: (message = "Invalid request") => new AppError(400, "VALIDATION_ERROR", message),
  unauthorized: (message = "Authentication required") =>
    new AppError(401, "UNAUTHORIZED", message),
  invalidCredentials: (message = "Invalid credentials") =>
    new AppError(401, "INVALID_CREDENTIALS", message),
  forbidden: (message = "You do not have access to this resource") =>
    new AppError(403, "FORBIDDEN", message),
  userExists: (message = "An account with that username already exists") =>
    new AppError(409, "USER_EXISTS", message),
  keyNotFound: (message = "API key not found") => new AppError(404, "KEY_NOT_FOUND", message),
  notFound: (message = "Resource not found") => new AppError(404, "NOT_FOUND", message),
  rateLimited: (message = "Too many requests") => new AppError(429, "RATE_LIMITED", message),
  internal: (message = "Internal server error") => new AppError(500, "INTERNAL_ERROR", message),
};

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export interface ApiSuccessBody<T> {
  success: true;
  data: T;
}

export function errorBody(code: ErrorCode, message: string): ApiErrorBody {
  return { success: false, error: { code, message } };
}

export function successBody<T>(data: T): ApiSuccessBody<T> {
  return { success: true, data };
}
