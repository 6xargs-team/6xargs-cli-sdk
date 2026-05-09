/**
 * POSIX exit codes used by every 6xargs command.
 *
 * - `SUCCESS`    (0)   — command completed normally
 * - `USER_ERROR` (1)   — bad input, invalid flags, missing required argument
 * - `API_ERROR`  (2)   — HTTP error, network failure, server 5xx
 * - `AUTH_ERROR` (3)   — missing/expired/revoked credentials
 * - `SIGINT`     (130) — user pressed Ctrl+C
 */
export const EXIT = {
  SUCCESS: 0,
  USER_ERROR: 1,
  API_ERROR: 2,
  AUTH_ERROR: 3,
  SIGINT: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** Base class for all CLI errors. Carries an exit code and an optional fix hint. */
export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode,
    public readonly hint?: string
  ) {
    super(message);
    this.name = "CliError";
  }
}

/** Thrown when the user provides invalid input (exit 1). */
export class UserError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, EXIT.USER_ERROR, hint);
    this.name = "UserError";
  }
}

/** Thrown on HTTP errors, network failures, or unexpected API responses (exit 2). */
export class ApiError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, EXIT.API_ERROR, hint);
    this.name = "ApiError";
  }
}

/** Thrown when credentials are missing, expired, or revoked (exit 3). */
export class AuthError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, EXIT.AUTH_ERROR, hint);
    this.name = "AuthError";
  }
}

/**
 * Normalises any thrown value into a `{ message, hint, exitCode }` triple.
 * Safe to call in `.catch()` blocks — never throws.
 */
export function formatError(err: unknown): { message: string; hint?: string; exitCode: ExitCode } {
  if (err instanceof CliError) {
    return { message: err.message, hint: err.hint, exitCode: err.exitCode };
  }
  if (err instanceof Error) {
    return { message: err.message, exitCode: EXIT.API_ERROR };
  }
  return { message: String(err), exitCode: EXIT.API_ERROR };
}
