// Typed error hierarchy with POSIX exit codes (0/1/2/3/130).
// All CLI errors extend CliError so formatError() always produces a user-facing message and fix hint.
export const EXIT = {
  SUCCESS: 0,
  USER_ERROR: 1,
  API_ERROR: 2,
  AUTH_ERROR: 3,
  SIGINT: 130,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

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

export class UserError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, EXIT.USER_ERROR, hint);
    this.name = "UserError";
  }
}

export class ApiError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, EXIT.API_ERROR, hint);
    this.name = "ApiError";
  }
}

export class AuthError extends CliError {
  constructor(message: string, hint?: string) {
    super(message, EXIT.AUTH_ERROR, hint);
    this.name = "AuthError";
  }
}

export function formatError(err: unknown): { message: string; hint?: string; exitCode: ExitCode } {
  if (err instanceof CliError) {
    return { message: err.message, hint: err.hint, exitCode: err.exitCode };
  }
  if (err instanceof Error) {
    return { message: err.message, exitCode: EXIT.API_ERROR };
  }
  return { message: String(err), exitCode: EXIT.API_ERROR };
}
