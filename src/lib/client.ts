// HTTP client for all 6xargs API calls — single choke point for auth header injection,
// retry (3×, exponential backoff), 429 Retry-After handling, zod validation, and 204 passthrough.
import { fetch, FormData } from "undici";
import { z } from "zod";
import { getApiBase, getCurrentProfile } from "./config.js";
import {
  USER_AGENT,
  RETRY_ATTEMPTS,
  RETRY_DELAYS_MS,
  REQUEST_TIMEOUT_MS,
} from "./constants.js";
import { ApiError, AuthError } from "./errors.js";

export interface RequestOptions {
  body?: unknown;
  /** Multipart form-data upload — mutually exclusive with body */
  formData?: FormData;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  /** Skip Authorization header — use for the token endpoint itself */
  noAuth?: boolean;
}

function requestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function debug(msg: string): void {
  if (process.env["SIXARGS_DEBUG"] === "true") {
    process.stderr.write(`[debug] ${msg}\n`);
  }
}

export async function request<T>(
  method: string,
  path: string,
  schema: z.ZodSchema<T>,
  opts: RequestOptions = {}
): Promise<T> {
  const profile = getCurrentProfile();
  const base = getApiBase(opts.headers?.["x-api-base-override"]);
  const fullUrl = `${base.replace(/\/$/, "")}${path}`;
  const url = new URL(fullUrl);

  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      url.searchParams.set(k, v);
    }
  }

  const reqId = requestId();
  const hasJsonBody = opts.body !== undefined && !opts.formData;
  const headers: Record<string, string> = {
    "user-agent": USER_AGENT,
    "x-request-id": reqId,
    "accept": "application/json",
    ...(hasJsonBody ? { "content-type": "application/json" } : {}),
    ...(!opts.noAuth && profile.jwt
      ? { authorization: `Bearer ${profile.jwt}` }
      : {}),
    ...opts.headers,
  };

  let attempt = 0;

  while (attempt <= RETRY_ATTEMPTS) {
    debug(`${method} ${url.toString()} (attempt ${attempt + 1})`);

    let res: Response;

    try {
      res = await fetch(url.toString(), {
        method,
        headers,
        body: opts.formData ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
        signal: AbortSignal.timeout(opts.timeout ?? REQUEST_TIMEOUT_MS),
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      debug(`network error: ${msg}`);

      if (attempt >= RETRY_ATTEMPTS) {
        throw new ApiError(
          `Network error: ${msg}`,
          "Check your connection or run: 6xargs config set api_base <url>"
        );
      }

      await sleep(RETRY_DELAYS_MS[attempt] ?? 4_000);
      attempt++;
      continue;
    }

    debug(`← ${res.status} ${res.statusText}`);

    // Rate limited — wait Retry-After then retry once
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1_000 : 5_000;
      debug(`rate limited, waiting ${waitMs}ms`);
      await sleep(waitMs);
      attempt++;
      continue;
    }

    // Unauthorized
    if (res.status === 401) {
      throw new AuthError(
        "Authentication failed. Token may be expired or revoked.",
        "Run: 6xargs login --api-key <your-key>"
      );
    }

    // Other client errors — no retry
    if (res.status >= 400 && res.status < 500) {
      let message = `HTTP ${res.status}`;
      try {
        const body = (await res.json()) as { error?: string; message?: string };
        message = body.error ?? body.message ?? message;
      } catch {
        // ignore parse error, keep status message
      }
      throw new ApiError(message);
    }

    // Server errors — retry
    if (res.status >= 500) {
      if (attempt >= RETRY_ATTEMPTS) {
        throw new ApiError(
          `Server error: HTTP ${res.status}`,
          "The API is unavailable. Try again in a moment."
        );
      }
      await sleep(RETRY_DELAYS_MS[attempt] ?? 4_000);
      attempt++;
      continue;
    }

    // 2xx — parse and validate (204 No Content returns empty body)
    let raw: unknown;
    try {
      raw = res.status === 204 ? {} : await res.json();
    } catch {
      raw = {};
    }
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      debug(`schema mismatch: ${parsed.error.message}`);
      throw new ApiError(
        "Unexpected API response format.",
        "Your CLI may be out of date. Run: npm i -g @6xargs/cli"
      );
    }

    return parsed.data;
  }

  throw new ApiError("Max retries exceeded.", "Try again later.");
}
