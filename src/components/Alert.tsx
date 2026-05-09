/**
 * Alert — termcn-style error/warning/info/success display.
 * Replaces the ad-hoc ErrorBox pattern that was duplicated across every command.
 */
import React from "react";
import { Box, Text } from "ink";

type AlertType = "error" | "warning" | "info" | "success";

export interface AlertProps {
  type?: AlertType;
  message: string;
  hint?: string;
}

const ICONS: Record<AlertType, string> = {
  error:   "✗",
  warning: "⚠",
  info:    "ℹ",
  success: "✓",
};

const COLORS: Record<AlertType, Parameters<typeof Text>[0]["color"]> = {
  error:   "red",
  warning: "yellow",
  info:    "cyan",
  success: "green",
};

export function Alert({ type = "error", message, hint }: AlertProps) {
  const icon  = ICONS[type];
  const color = COLORS[type];
  const tinted = type === "error" || type === "warning";

  return (
    <Box flexDirection="column">
      <Box gap={1}>
        <Text color={color}>{icon}</Text>
        <Text color={tinted ? color : undefined}>{message}</Text>
      </Box>
      {hint && <Text dimColor>  {hint}</Text>}
    </Box>
  );
}
