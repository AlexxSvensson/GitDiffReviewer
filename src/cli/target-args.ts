import { AxiError } from "axi-sdk-js";

export interface ParsedTargetArgs {
  target: string;
  base: string;
  staged: boolean;
  /** What actually gets hashed into the review id — must match between `<target>` and `comments <target>`. */
  baseKey: string;
}

export function parseTargetArgs(args: string[]): ParsedTargetArgs {
  const target = args[0] ?? ".";
  let base = "HEAD";
  let staged = false;

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--staged") {
      staged = true;
    } else if (arg === "--base") {
      i += 1;
      const value = args[i];
      if (!value) {
        throw new AxiError("--base requires a ref argument", "VALIDATION_ERROR", ["Example: --base main"]);
      }
      base = value;
    } else if (arg === "--no-open" || arg === "--port") {
      // Recognized for forward compatibility; the review server lands in a later milestone.
      if (arg === "--port") i += 1;
    } else {
      throw new AxiError(`Unknown flag: ${arg}`, "VALIDATION_ERROR", [
        "Supported flags: --staged, --base <ref>, --no-open, --port <n>",
      ]);
    }
  }

  return { target, base, staged, baseKey: staged ? "staged" : base };
}
