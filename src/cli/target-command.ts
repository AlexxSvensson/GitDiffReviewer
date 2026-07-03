import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AxiCliCommand } from "axi-sdk-js";
import { resolveRepoRoot } from "../git/repo.js";
import { buildReviewPayload } from "../review/build-payload.js";
import { computeReviewId } from "../review/hash.js";
import { reviewDir } from "../review/store.js";
import { renderReviewPage } from "../server/page-template.js";
import type { CliContext } from "./context.js";
import { parseTargetArgs } from "./target-args.js";

// dist/cli/target-command.js -> dist/frontend/{bundle.js,bundle.css}
const FRONTEND_DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend");

/**
 * `diff-review <target>` — M2: renders the real side-by-side diff view to a
 * static HTML file under ~/.diff-review/<id>/review/ for manual viewing. The
 * live save server + automatic browser-open land in a later milestone (M3);
 * --staged/--base/--no-open/--port are already parsed but --no-open and
 * --port have no effect yet since there is no server to suppress/configure.
 */
export const targetCommand: AxiCliCommand<CliContext> = async (args, context) => {
  const cwd = context?.cwd ?? process.cwd();
  const parsed = parseTargetArgs(args);
  const repoRoot = await resolveRepoRoot(resolve(cwd, parsed.target));
  const reviewId = computeReviewId(repoRoot, parsed.baseKey);

  const payload = await buildReviewPayload(repoRoot, reviewId, parsed.baseKey, {
    base: parsed.base,
    staged: parsed.staged,
  });

  const pageDir = join(reviewDir(reviewId), "review");
  const assetsDir = join(pageDir, "assets");
  await mkdir(assetsDir, { recursive: true });
  await Promise.all([
    copyFile(join(FRONTEND_DIST_DIR, "bundle.js"), join(assetsDir, "bundle.js")),
    copyFile(join(FRONTEND_DIST_DIR, "bundle.css"), join(assetsDir, "bundle.css")),
  ]);

  const html = renderReviewPage(payload, { js: "./assets/bundle.js", css: "./assets/bundle.css" });
  const indexPath = join(pageDir, "index.html");
  await writeFile(indexPath, html, "utf8");

  return {
    repoRoot,
    baseRef: parsed.baseKey,
    reviewId,
    changedFiles: payload.files.map((file) => ({
      status: file.status,
      path: file.path,
      binary: file.binary,
    })),
    reviewPage: indexPath,
    note: "Open reviewPage in a browser to view the diff. Auto-open + the save server land in a later milestone.",
  };
};
