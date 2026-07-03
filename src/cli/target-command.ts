import { resolve } from "node:path";
import type { AxiCliCommand } from "axi-sdk-js";
import { listChangedFiles, listUntrackedFiles } from "../git/diff.js";
import { resolveRepoRoot } from "../git/repo.js";
import { computeReviewId } from "../review/hash.js";
import type { CliContext } from "./context.js";
import { parseTargetArgs } from "./target-args.js";

/**
 * M1 stub for `diff-review <target>`: resolves the git layer and reports what
 * a review would cover. The browser review UI + save server land in a later
 * milestone (M2/M3) — this only proves the git/hash plumbing end to end.
 */
export const targetCommand: AxiCliCommand<CliContext> = async (args, context) => {
  const cwd = context?.cwd ?? process.cwd();
  const parsed = parseTargetArgs(args);
  const repoRoot = await resolveRepoRoot(resolve(cwd, parsed.target));

  const diffOpts = { base: parsed.base, staged: parsed.staged };
  const [changedFiles, untrackedFiles] = await Promise.all([
    listChangedFiles(repoRoot, diffOpts),
    listUntrackedFiles(repoRoot),
  ]);

  const reviewId = computeReviewId(repoRoot, parsed.baseKey);

  return {
    repoRoot,
    baseRef: parsed.baseKey,
    reviewId,
    changedFiles: changedFiles.map((file) => ({
      status: file.status,
      path: file.path,
      binary: file.binary,
    })),
    untrackedFiles,
    note: "Browser review UI not implemented yet (coming in a later milestone) — this lists what a review would cover.",
  };
};
