import { runAxiCli } from "axi-sdk-js";
import { commentsCommand } from "./comments-command.js";
import type { CliContext } from "./context.js";
import { homeCommand } from "./home.js";
import { setupHooksCommand } from "./setup-hooks-command.js";
import { targetCommand } from "./target-command.js";

const RESERVED_FIRST_ARGS = new Set(["comments", "setup", "update"]);

/**
 * axi-sdk-js routes by looking up a fixed command name in `argv[0]`, but our
 * primary UX is `diff-review <target>` where <target> is an arbitrary path.
 * Rewrite any first token that isn't one of our reserved subcommands (or a
 * leading flag) to `open <target> ...` so it hits a registered handler.
 */
function buildEffectiveArgv(rawArgv: string[]): string[] {
  const [first, ...rest] = rawArgv;
  if (first === undefined || first.startsWith("-") || RESERVED_FIRST_ARGS.has(first)) {
    return rawArgv;
  }
  return ["open", first, ...rest];
}

const TOP_LEVEL_HELP = `diff-review — review uncommitted git diffs in a browser, hand comments back as TOON.

Usage:
  diff-review                     Show home view
  diff-review <target>            Open a review for <target> (defaults to ".")
  diff-review comments <target>   Read back saved comments as TOON
  diff-review setup hooks         Install SessionStart hooks

Flags (after the target): --staged, --base <ref>, --no-open, --port <n>
`;

export async function main(): Promise<void> {
  await runAxiCli<CliContext>({
    description: "Review uncommitted git diffs in a browser; hand comments back to an agent as TOON.",
    version: "0.1.0",
    topLevelHelp: TOP_LEVEL_HELP,
    argv: buildEffectiveArgv(process.argv.slice(2)),
    home: homeCommand,
    resolveContext: () => ({ cwd: process.cwd() }),
    commands: {
      open: targetCommand,
      comments: commentsCommand,
      setup: setupHooksCommand,
    },
  });
}
