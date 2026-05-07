import React from "react";
import { Box, Text } from "ink";
import chalk from "chalk";
import { getCurrentProfile } from "../lib/config.js";

// ── Ink component — embed in any render tree ──────────────────────────────────

interface StatusBarProps {
  now?: Date;
}

export function StatusBar({ now = new Date() }: StatusBarProps) {
  const profile = getCurrentProfile();

  const timeStr =
    now.toLocaleDateString("en-US", { weekday: "short", day: "2-digit" }) +
    " " +
    now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const segments: string[] = [
    `● ${profile.username ?? "anon"}`,
    profile.firm_name ? `● ${profile.firm_name}` : null,
    profile.plan ? `● ${profile.plan.toUpperCase()}` : null,
    `● ${timeStr}`,
  ].filter((s): s is string => s !== null);

  return (
    <Box>
      <Text dimColor>{segments.join(" │ ")}</Text>
    </Box>
  );
}

// ── stderr writer — used by banner.ts (no Ink context required) ───────────────

export function printStatusBar(now = new Date()): void {
  let profile: ReturnType<typeof getCurrentProfile>;
  try {
    profile = getCurrentProfile();
  } catch {
    return; // config not initialized yet, skip bar
  }

  const timeStr =
    now.toLocaleDateString("en-US", { weekday: "short", day: "2-digit" }) +
    " " +
    now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  const segments: string[] = [
    `● ${profile.username ?? "anon"}`,
    profile.firm_name ? `● ${profile.firm_name}` : null,
    profile.plan ? `● ${profile.plan.toUpperCase()}` : null,
    `● ${timeStr}`,
  ].filter((s): s is string => s !== null);

  process.stderr.write(chalk.dim(segments.join(" │ ")) + "\n");
}
