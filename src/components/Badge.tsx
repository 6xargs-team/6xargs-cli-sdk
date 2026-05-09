/**
 * Badge — termcn-style colored label for plan tiers and job statuses.
 *
 * variant="plan"   → colored uppercase plan name (STARTER / PRO / ENTERPRISE)
 * variant="status" → colored status icon (✓ / ✗ / ○ / ⠋)
 */
import React from "react";
import { Text } from "ink";

type PlanTier  = "starter" | "pro" | "enterprise";
type JobStatus = "pending" | "processing" | "completed" | "failed";

const PLAN_COLORS: Record<PlanTier, Parameters<typeof Text>[0]["color"]> = {
  starter:    "yellow",
  pro:        "cyan",
  enterprise: "magenta",
};

const STATUS_COLORS: Record<JobStatus, Parameters<typeof Text>[0]["color"]> = {
  pending:    "yellow",
  processing: "blue",
  completed:  "green",
  failed:     "red",
};

const STATUS_ICONS: Record<JobStatus, string> = {
  pending:    "○",
  processing: "⠋",
  completed:  "✓",
  failed:     "✗",
};

export interface BadgeProps {
  variant: "plan" | "status";
  value: string;
}

export function Badge({ variant, value }: BadgeProps) {
  if (variant === "plan") {
    const color = PLAN_COLORS[value as PlanTier] ?? "white";
    return <Text color={color}>{value.toUpperCase()}</Text>;
  }

  const color = STATUS_COLORS[value as JobStatus] ?? "white";
  const icon  = STATUS_ICONS[value as JobStatus] ?? "○";
  return <Text color={color}>{icon}</Text>;
}
