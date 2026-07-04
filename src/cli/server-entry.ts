import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReviewPayload } from "../review/build-payload.js";
import { writeMeta } from "../review/store.js";
import { createReviewServer } from "../server/review-server.js";

// dist/cli/server-entry.js -> dist/frontend/{bundle.js,bundle.css}
const FRONTEND_DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "frontend");

interface ServerEntryArgs {
  repoRoot: string;
  base: string;
  staged: boolean;
  reviewId: string;
  port?: number;
}

/** argv: repoRoot base staged("1"|"0") reviewId [port] */
function parseArgv(argv: string[]): ServerEntryArgs {
  const [repoRoot, base, stagedFlag, reviewId, portArg] = argv;
  if (!repoRoot || !base || !reviewId) {
    throw new Error("server-entry requires: repoRoot base staged reviewId [port]");
  }
  return {
    repoRoot,
    base,
    staged: stagedFlag === "1",
    reviewId,
    port: portArg ? Number(portArg) : undefined,
  };
}

async function main(): Promise<void> {
  const args = parseArgv(process.argv.slice(2));
  const baseRef = args.staged ? "staged" : args.base;
  const diffOpts = { base: args.base, staged: args.staged };

  const payload = await buildReviewPayload(args.repoRoot, args.reviewId, baseRef, diffOpts);

  await writeMeta(args.reviewId, {
    repoRoot: args.repoRoot,
    baseRef,
    staged: args.staged,
    createdAt: new Date().toISOString(),
    changedFiles: payload.files.map((file) => file.path),
  });

  const handle = await createReviewServer(payload, args.reviewId, {
    port: args.port,
    assetsDir: FRONTEND_DIST_DIR,
    onSaved: () => process.stdout.write("SAVED\n"),
    onClose: () => process.exit(0),
  });

  // Handshake lines the parent CLI process reads: "LISTENING <url>" once the
  // server is up (after which it normally stops listening and exits — this
  // process keeps running as the server), and "SAVED" once a review has been
  // submitted, which a `--wait` invocation stays attached to hear.
  process.stdout.write(`LISTENING ${handle.url}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
