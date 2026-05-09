/**
 * `conf`-backed config store validated with Zod on every read.
 *
 * Stored at the XDG config path (`~/.config/6xargs/config.json` on Linux/macOS,
 * `%APPDATA%\6xargs\config.json` on Windows). A corrupt or missing file silently
 * resets to defaults — a bad file never blocks startup.
 *
 * Resolution order for all settings: CLI flag → env var → config file → default.
 */
import Conf from "conf";
import { ConfigSchema, ProfileSchema } from "../types/config.js";
import type { Config, Profile } from "../types/config.js";
import { UserError } from "./errors.js";

const store = new Conf<Record<string, unknown>>({
  projectName: "6xargs",
  projectSuffix: "",
});

function read(): Config {
  try {
    return ConfigSchema.parse(store.store);
  } catch {
    // Corrupt config — reset to defaults and warn
    process.stderr.write("Warning: config corrupted, resetting to defaults.\n");
    store.clear();
    const defaults = ConfigSchema.parse({});
    store.store = defaults as unknown as Record<string, unknown>;
    return defaults;
  }
}

/** Returns the full config object including all profiles. */
export function getConfig(): Config {
  return read();
}

/** Returns the active profile's fields. Falls back to empty defaults if the profile is missing. */
export function getCurrentProfile(): Profile {
  const config = read();
  const profile = config.profiles[config.current_profile];
  if (!profile) {
    // Current profile missing — return empty default
    return ProfileSchema.parse({});
  }
  return profile;
}

/** Writes a single field to the active profile without touching other fields. */
export function setProfileField<K extends keyof Profile>(key: K, value: Profile[K]): void {
  const config = read();
  const name = config.current_profile;
  const existing = config.profiles[name] ?? ProfileSchema.parse({});
  config.profiles[name] = { ...existing, [key]: value };
  store.store = config as unknown as Record<string, unknown>;
}

/** Activates a named profile, creating it with empty defaults if it does not exist. */
export function switchProfile(name: string): void {
  const config = read();
  if (!config.profiles[name]) {
    config.profiles[name] = ProfileSchema.parse({});
  }
  config.current_profile = name;
  store.store = config as unknown as Record<string, unknown>;
}

/** Wipes all config and resets to factory defaults. */
export function resetConfig(): void {
  store.clear();
}

/**
 * Resolves the API base URL.
 * Priority: `override` arg → `SIXARGS_API_BASE` env var → profile → default (`https://api.6xargs.com`).
 */
export function getApiBase(override?: string): string {
  if (override) return override;
  if (process.env["SIXARGS_API_BASE"]) return process.env["SIXARGS_API_BASE"];
  return getCurrentProfile().api_base;
}

/**
 * Resolves the API key.
 * Priority: `override` arg → `SIXARGS_API_KEY` env var → profile.
 * Throws `UserError` if no key is found.
 */
export function getApiKey(override?: string): string {
  if (override) return override;
  if (process.env["SIXARGS_API_KEY"]) return process.env["SIXARGS_API_KEY"];
  const key = getCurrentProfile().api_key;
  if (!key) {
    throw new UserError(
      "Not logged in.",
      "Run: 6xargs login --api-key <your-key>"
    );
  }
  return key;
}

export function getOutputFormat(override?: string): string {
  if (override) return override;
  if (process.env["SIXARGS_OUTPUT_FORMAT"]) return process.env["SIXARGS_OUTPUT_FORMAT"];
  return getCurrentProfile().output_format;
}
