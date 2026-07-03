import { AxiError, installSessionStartHooks, type AxiCliCommand } from "axi-sdk-js";
import type { CliContext } from "./context.js";

export const setupHooksCommand: AxiCliCommand<CliContext> = (args) => {
  if (args[0] !== "hooks") {
    throw new AxiError(`Unknown setup subcommand: ${args[0] ?? "(none)"}`, "VALIDATION_ERROR", [
      "Did you mean `diff-review setup hooks`?",
    ]);
  }

  let errorMessage: string | undefined;
  installSessionStartHooks({
    onError: (message) => {
      errorMessage = message;
    },
  });

  if (errorMessage) {
    throw new AxiError(errorMessage, "HOOK_INSTALL_FAILED");
  }
  // installSessionStartHooks() returns void and silently no-ops (by design) when
  // it can't recognize the invoking script as an installed axi binary — e.g.
  // running straight from a dev checkout instead of a global npm install. It
  // gives us no signal to distinguish "installed" from "skipped", so avoid
  // overclaiming success here.
  return {
    attempted: true,
    note: "Idempotent — check ~/.claude/settings.json or ~/.codex/hooks.json to confirm a hook was written",
  };
};
