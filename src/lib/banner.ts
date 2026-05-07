// Startup banner — spinner animation followed by the split info/octopus layout.
// Writes to stderr so stdout stays pipe-clean. No-ops when not a TTY.
import chalk from "chalk";
import { VERSION, OCTOPUS } from "./constants.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_MS = 70;
const SPINNER_DURATION_MS = 600;

// Divider between info box (left) and octopus (right)
const DIVIDER = "  │  ";

// Precompute octopus line data once — used for width calculations
const OCT_LINES = OCTOPUS.split("\n");
const OCT_W = Math.max(...OCT_LINES.map((l) => l.length));

function isTTY(): boolean {
  return process.stderr.isTTY === true;
}

// ── Gradient ──────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

// Orange-pastel #FFB775 → purple-pastel #B782FF interpolated by line position (t ∈ [0,1])
function colorize(t: number, s: string): string {
  return chalk.rgb(lerp(255, 183, t), lerp(183, 130, t), lerp(117, 255, t))(s);
}

// ── Info box ──────────────────────────────────────────────────────────────────
//
// All lines are exactly (innerW + 2) chars:
//   border  →  ╭ + innerW×"─" + ╮
//   content →  │ + space + text.padEnd(innerW - 2) + space + │

function buildInfoBox(apiBase: string, innerW: number): string[] {
  const api = apiBase.replace(/^https?:\/\//, "");
  const maxContent = innerW - 2;

  const fit = (s: string): string =>
    s.length > maxContent ? s.slice(0, maxContent - 3) + "..." : s;

  const row = (text: string): string =>
    `│ ${fit(text).padEnd(maxContent)} │`;

  return [
    `╭${"─".repeat(innerW)}╮`,
    row(`>_ 6xargs CLI (v${VERSION})`),
    row(""),
    row(`api:  ${api}`),
    row("docs: docs.6xargs.com"),
    `╰${"─".repeat(innerW)}╯`,
  ];
}

// ── Layout ────────────────────────────────────────────────────────────────────

function buildBanner(apiBase: string): string {
  const termW = Math.max(
    process.stderr.columns ?? 0,
    process.stdout.columns ?? 0,
    60
  );

  // Minimum width required for side-by-side layout (min boxInner = 31)
  //   2 margin + (31 + 2) box + divider + octopus
  const sideBySideMin = 2 + 33 + DIVIDER.length + OCT_W;

  let rows: string[];

  if (termW >= sideBySideMin) {
    // Grow info box up to innerW 41, shrink if terminal is narrow
    const innerW = Math.max(31, Math.min(41, termW - 2 - DIVIDER.length - OCT_W - 2));
    const boxLines = buildInfoBox(apiBase, innerW);
    const boxW = innerW + 2; // total chars per box line (borders included)
    const total = Math.max(OCT_LINES.length, boxLines.length);

    rows = Array.from({ length: total }, (_, i) => {
      // Info box on left, octopus on right — matches CLAUDE.md spec
      const box = (boxLines[i] ?? " ".repeat(boxW)).padEnd(boxW);
      const oct = OCT_LINES[i] ?? "";
      return `  ${box}${DIVIDER}${oct}`;
    });
  } else {
    // Narrow terminal: info box only, centered with 2-char left margin
    const innerW = Math.max(27, Math.min(41, termW - 4));
    rows = buildInfoBox(apiBase, innerW).map((l) => `  ${l}`);
  }

  const n = rows.length;
  return rows.map((row, i) => colorize(i / Math.max(n - 1, 1), row)).join("\n");
}

// ── Export ────────────────────────────────────────────────────────────────────

export async function showBanner(apiBase = "https://api.6xargs.com"): Promise<void> {
  if (!isTTY()) return;

  // Spinner uses the orange end of the gradient
  let frame = 0;
  const interval = setInterval(() => {
    process.stderr.write(
      `\r${chalk.rgb(255, 183, 117)(SPINNER_FRAMES[frame])} Initializing 6xargs...`
    );
    frame = (frame + 1) % SPINNER_FRAMES.length;
  }, SPINNER_MS);

  await new Promise<void>((resolve) => setTimeout(resolve, SPINNER_DURATION_MS));
  clearInterval(interval);
  process.stderr.write("\r\x1b[K");
  process.stderr.write("\n" + buildBanner(apiBase) + "\n\n");
}
