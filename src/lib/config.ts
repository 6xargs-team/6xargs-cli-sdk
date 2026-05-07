// conf-backed config store validated with zod on every read.
// Corrupt or missing config silently resets to defaults — a bad file never blocks startup.
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

export function getConfig(): Config {
  return read();
}

export function getCurrentProfile(): Profile {
  const config = read();
  const profile = config.profiles[config.current_profile];
  if (!profile) {
    // Current profile missing — return empty default
    return ProfileSchema.parse({});
  }
  return profile;
}

export function setProfileField<K extends keyof Profile>(key: K, value: Profile[K]): void {
  const config = read();
  const name = config.current_profile;
  const existing = config.profiles[name] ?? ProfileSchema.parse({});
  config.profiles[name] = { ...existing, [key]: value };
  store.store = config as unknown as Record<string, unknown>;
}

export function switchProfile(name: string): void {
  const config = read();
  if (!config.profiles[name]) {
    config.profiles[name] = ProfileSchema.parse({});
  }
  config.current_profile = name;
  store.store = config as unknown as Record<string, unknown>;
}

export function resetConfig(): void {
  store.clear();
}

export function getApiBase(override?: string): string {
  if (override) return override;
  if (process.env["SIXARGS_API_BASE"]) return process.env["SIXARGS_API_BASE"];
  return getCurrentProfile().api_base;
}

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
