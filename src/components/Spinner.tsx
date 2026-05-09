/**
 * Spinner — termcn-style animated loading indicator.
 * Self-contained: manages its own frame state and interval.
 * Replaces the repeated SPINNER const + frame useState + setInterval pattern in every command.
 */
import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";

const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export interface SpinnerProps {
  label: string;
  color?: Parameters<typeof Text>[0]["color"];
}

export function Spinner({ label, color = "cyan" }: SpinnerProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((f) => (f + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);

  return (
    <Box gap={1}>
      <Text color={color}>{FRAMES[frame]}</Text>
      <Text>{label}</Text>
    </Box>
  );
}
