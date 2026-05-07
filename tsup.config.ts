import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  bundle: true,
  clean: true,
  sourcemap: true,
  outExtension() {
    return { js: ".mjs" };
  },
  esbuildOptions(options) {
    options.jsx = "automatic";
    options.banner = {
      js: "#!/usr/bin/env node",
    };
  },
});
