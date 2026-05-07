import chalk from "chalk";
import {
  getConfig,
  getCurrentProfile,
  setProfileField,
  switchProfile,
  resetConfig,
} from "../lib/config.js";
import { UserError } from "../lib/errors.js";
import type { Profile } from "../types/config.js";

const SETTABLE_KEYS = ["output_format", "api_base"] as const;
type SettableKey = (typeof SETTABLE_KEYS)[number];

const ALL_READABLE_KEYS = new Set<string>([
  "username",
  "api_key",
  "jwt_expires_at",
  "api_base",
  "firm_id",
  "firm_name",
  "plan",
  "output_format",
]);

function isSettable(key: string): key is SettableKey {
  return (SETTABLE_KEYS as readonly string[]).includes(key);
}

function maskApiKey(key: string): string {
  if (key.length <= 20) return "sk_live_6xargs_...";
  return `${key.slice(0, 20)}...${key.slice(-4)}`;
}

export function configGet(key: string): void {
  if (!ALL_READABLE_KEYS.has(key)) {
    throw new UserError(
      `Unknown config key: ${key}`,
      `Valid keys: ${Array.from(ALL_READABLE_KEYS).join(", ")}`
    );
  }

  const profile = getCurrentProfile();
  const value = profile[key as keyof Profile];
  let display = String(value ?? "");
  if (key === "api_key" && display) display = maskApiKey(display);
  process.stdout.write(display + "\n");
}

export function configSet(key: string, value: string): void {
  if (!isSettable(key)) {
    throw new UserError(
      `Cannot set key: ${key}`,
      `Settable keys: ${SETTABLE_KEYS.join(", ")}`
    );
  }

  if (key === "output_format") {
    if (!["table", "json", "yaml", "raw"].includes(value)) {
      throw new UserError(`Invalid output_format: ${value}`, "Valid: table|json|yaml|raw");
    }
    // value is validated as a member of the OutputFormat enum
    setProfileField("output_format", value as "table" | "json" | "yaml" | "raw");
  } else {
    if (!value.startsWith("https://") && !value.startsWith("http://localhost")) {
      throw new UserError(
        `api_base must be HTTPS (or http://localhost for dev).`,
        `Received: ${value}`
      );
    }
    setProfileField("api_base", value);
  }

  process.stdout.write(chalk.green("✓ ") + `${key} = ${value}\n`);
}

export function configList(): void {
  const config = getConfig();
  const { current_profile, profiles } = config;

  process.stdout.write(chalk.dim("current profile: ") + chalk.bold(current_profile) + "\n\n");

  for (const [profileName, profile] of Object.entries(profiles)) {
    const active = profileName === current_profile;
    process.stdout.write(
      (active ? chalk.cyan("▸ ") : "  ") + chalk.bold(profileName) + "\n"
    );

    for (const [k, v] of Object.entries(profile)) {
      if (k === "jwt") continue; // never display bearer token
      let display = String(v ?? "");
      if (k === "api_key" && display) display = maskApiKey(display);
      process.stdout.write(`    ${chalk.dim(k.padEnd(16))} ${display}\n`);
    }
    process.stdout.write("\n");
  }
}

export function configReset(): void {
  resetConfig();
  process.stdout.write(chalk.green("✓ ") + "Config reset to defaults.\n");
}

export function configSwitchProfile(name: string): void {
  switchProfile(name);
  process.stdout.write(chalk.green("✓ ") + `Switched to profile: ${name}\n`);
}
