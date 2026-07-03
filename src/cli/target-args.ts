import { AxiError } from "axi-sdk-js";

export interface ParsedTargetArgs {
  target: string;
  base: string;
  staged: boolean;
  /** What actually gets hashed into the review id — must match between `<target>` and `comments <target>`. */
  baseKey: string;
  noOpen: boolean;
  /** undefined = let the OS assign an ephemeral port. */
  port: number | undefined;
}

export function parseTargetArgs(args: string[]): ParsedTargetArgs {
  const target = args[0] ?? ".";
  let base = "HEAD";
  let staged = false;
  let noOpen = false;
  let port: number | undefined;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--staged") {
      staged = true;
    } else if (arg === "--no-open") {
      noOpen = true;
    } else if (arg === "--base") {
      i += 1;
      const value = args[i];
      if (!value) {
        throw new AxiError("--base requires a ref argument", "VALIDATION_ERROR", ["Example: --base main"]);
      }
      base = value;
    } else if (arg === "--port") {
      i += 1;
      const value = args[i];
      const parsed = value ? Number(value) : NaN;
      if (!value || !Number.isInteger(parsed) || parsed < 0 || parsed > 65535) {
        throw new AxiError("--port requires a valid port number (0-65535)", "VALIDATION_ERROR", [
          "Example: --port 4173",
          "Use --port 0 (or omit it) to let the OS assign a free port",
        ]);
      }
      port = parsed;
    } else {
      throw new AxiError(`Unknown flag: ${arg}`, "VALIDATION_ERROR", [
        "Supported flags: --staged, --base <ref>, --no-open, --port <n>",
      ]);
    }
  }

  return { target, base, staged, baseKey: staged ? "staged" : base, noOpen, port };
}
