import chalk from "chalk";
import { VERSION, OCTOPUS } from "./constants.js";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const SPINNER_MS = 70;
const SPINNER_DURATION_MS = 600;

function isTTY(): boolean {
  return process.stderr.isTTY === true;
}

function buildInfoBox(apiBase: string): string {
  const ver = `v${VERSION}`;
  const apiLine = apiBase.replace("https://", "").replace("http://", "");
  return [
    "╭───────────────────────────────────────╮",
    "│                                       │",
    "│  ██████╗ ██╗  ██╗ █████╗ ██████╗  ██████╗ ███████╗      ██████╗██╗     ██╗",
    "│ ██╔════╝ ╚██╗██╔╝██╔══██╗██╔══██╗██╔════╝ ██╔════╝     ██╔════╝██║     ██║",
    "│ ██████╗   ╚███╔╝ ███████║██████╔╝██║  ███╗███████╗     ██║     ██║     ██║",
    "│ ██╔══██╗  ██╔██╗ ██╔══██║██╔══██╗██║   ██║╚════██║     ██║     ██║     ██║",
    "│ ╚██████╔╝██╔╝ ██╗██║  ██║██║  ██║╚██████╔╝███████║     ╚██████╗███████╗██║",
    "│  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝      ╚═════╝╚══════╝╚═╝",
    "╭───────────────────────────────────────╮",
    `│ >_ 6xargs CLI ${ver.padEnd(24)}       │`,
    "│                                       │",
    `│ api:  ${apiLine.padEnd(32)}           │`,
    `│ docs: docs.6xargs.com                 │`,
    "╰───────────────────────────────────────╯",
  ].join("\n");
}

function buildBanner(apiBase: string): string {
  const octopusLines = OCTOPUS.split("\n");
  const infoLines = buildInfoBox(apiBase).split("\n");

  const divider = "│";
  const maxOct = Math.max(...octopusLines.map((l) => l.length));
  const maxInfo = Math.max(...infoLines.map((l) => l.length));
  const totalLines = Math.max(octopusLines.length, infoLines.length);

  const rows: string[] = [];
  for (let i = 0; i < totalLines; i++) {
    const oct = (octopusLines[i] ?? "").padEnd(maxOct);
    const inf = (infoLines[i] ?? "").padEnd(maxInfo);
    rows.push(`  ${chalk.magenta(oct)}  ${chalk.gray(divider)}  ${inf}`);
  }

  return rows.join("\n");
}

export async function showBanner(apiBase = "https://api.6xargs.com"): Promise<void> {
  if (!isTTY()) return;

  // Spinner animation
  let frame = 0;
  const interval = setInterval(() => {
    process.stderr.write(`\r${chalk.magenta(SPINNER_FRAMES[frame])} Initializing 6xargs...`);
    frame = (frame + 1) % SPINNER_FRAMES.length;
  }, SPINNER_MS);

  await new Promise<void>((resolve) => setTimeout(resolve, SPINNER_DURATION_MS));
  clearInterval(interval);

  // Clear spinner line
  process.stderr.write("\r\x1b[K");

  // Banner
  process.stderr.write("\n" + buildBanner(apiBase) + "\n\n");
}
