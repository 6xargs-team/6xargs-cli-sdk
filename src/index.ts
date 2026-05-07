// Entry point. Masks sensitive flags in the process title, wires SIGINT → exit 130,
// shows the startup banner, then hands off to Commander for argument parsing.
import { createCLI } from "./cli.js";
import { showBanner } from "./lib/banner.js";
import { getApiBase } from "./lib/config.js";

process.title = "6xargs";

// Mask --api-key value in process listing before Commander parses
const keyIdx = process.argv.indexOf("--api-key");
if (keyIdx !== -1 && process.argv[keyIdx + 1] !== undefined) {
  // keep original for Commander to parse, mask in title only
  process.title = "6xargs [auth]";
}

process.on("SIGINT", () => process.exit(130));

(async () => {
  await showBanner(getApiBase());
  await createCLI().parseAsync(process.argv);
})().catch((err: unknown) => {
  if (process.env["SIXARGS_DEBUG"] === "true") {
    console.error(err);
  }
  process.exit(1);
});
