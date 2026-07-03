import { resolve } from "node:path";
import { AxiError, type AxiCliCommand } from "axi-sdk-js";
import { resolveRepoRoot } from "../git/repo.js";
import { computeReviewId } from "../review/hash.js";
import { readCommentsRaw } from "../review/store.js";
import type { CliContext } from "./context.js";
import { parseTargetArgs } from "./target-args.js";

export const commentsCommand: AxiCliCommand<CliContext> = async (args, context) => {
  const cwd = context?.cwd ?? process.cwd();
  const parsed = parseTargetArgs(args);
  const repoRoot = await resolveRepoRoot(resolve(cwd, parsed.target));
  const reviewId = computeReviewId(repoRoot, parsed.baseKey);

  const raw = await readCommentsRaw(reviewId);
  if (raw === null) {
    throw new AxiError("No saved review found for this target", "NOT_FOUND", [
      "Run `diff-review <target>` first",
      'Then finish the review in the browser and click "review done"',
    ]);
  }
  return raw;
};
