// Central source for all tunable values. RETRY_DELAYS_MS and timeouts are consumed by client.ts.
// API_KEY_PATTERN is the canonical format enforced at login and validated before any API call.
export const VERSION = "0.1.2";

export const DEFAULT_API_BASE = "https://api.6xargs.com";

export const API_BASE = process.env["SIXARGS_API_BASE"] ?? DEFAULT_API_BASE;

export const USER_AGENT = `6xargs-cli/${VERSION}`;

export const API_KEY_PATTERN = /^sk_live_6xargs_[a-zA-Z0-9]{24,}$/;

export const REQUEST_TIMEOUT_MS = 30_000;
export const UPLOAD_TIMEOUT_MS = 120_000;
export const QUERY_TIMEOUT_MS = 60_000;

export const RETRY_ATTEMPTS = 3;
export const RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

export const INGEST_POLL_INTERVAL_MS = 2_000;
export const INGEST_MAX_FILE_MB = 50;

export const OCTOPUS = `
             ▗▄▄▄▄▄▄▖
          ▗▛████████▜▖
        ▗▛████████████▜▖
       ▐██████▛▜██████▌
       ██████████████████
       ████!██████!████
       ▜██████████████▛
    ▗▞██▛▀▘▝██▘▝▀▜██▚▖
  ▗▞██▛▘  ▗████▖  ▝▜██▚▖
 ▐██▛    ▐██████▌    ▝██▌
▐██▘    ▗██▛▜██▚▖     ▝██▌
 ▜▌    ▗██▘  ▝██▖      ▐▛
  ▝▚▖ ▗██▘    ▝██▖   ▗▞▘
    ▝▚▞▘        ▝▚▞▘`.trim();
