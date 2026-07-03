import { build } from "esbuild";

await build({
  entryPoints: ["src/frontend/main.tsx", "src/frontend/styles.css"],
  bundle: true,
  outdir: "dist/frontend",
  entryNames: "bundle",
  format: "iife",
  target: "es2020",
  platform: "browser",
  jsx: "automatic",
  jsxImportSource: "preact",
  sourcemap: true,
  logLevel: "info",
});
