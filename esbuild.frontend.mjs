import { build } from "esbuild";

await build({
  entryPoints: ["src/frontend/main.ts", "src/frontend/styles.css"],
  bundle: true,
  outdir: "dist/frontend",
  entryNames: "bundle",
  format: "iife",
  target: "es2020",
  platform: "browser",
  sourcemap: true,
  logLevel: "info",
});
