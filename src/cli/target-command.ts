import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AxiError, type AxiCliCommand } from "axi-sdk-js";
import { listChangedFiles, listUntrackedFiles } from "../git/diff.js";
import { resolveRepoRoot } from "../git/repo.js";
import { computeReviewId } from "../review/hash.js";
import type { CliContext } from "./context.js";
import { parseTargetArgs } from "./target-args.js";

const SERVER_ENTRY = join(dirname(fileURLToPath(import.meta.url)), "server-entry.js");
const HANDSHAKE_TIMEOUT_MS = 5000;

/**
 * Spawns the review server as a detached child and resolves once it prints
 * its "LISTENING <url>" handshake line. Destroys the piped stdio afterward so
 * this process holds no open handle to the child — the child (detached +
 * unref'd) keeps running as the server on its own, and this process is free
 * to exit immediately (README: "agenten hänger inte kvar").
 */
function spawnDetachedServer(args: string[]): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY, ...args], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    let settled = false;

    const timeout = setTimeout(() => {
      finish(() => {
        child.kill();
        reject(new Error("Timed out waiting for the review server to start"));
      });
    }, HANDSHAKE_TIMEOUT_MS);

    function finish(action: () => void): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref();
      action();
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      const match = stdoutBuf.match(/^LISTENING (\S+)/m);
      if (match) finish(() => resolvePromise(match[1]));
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });
    child.once("error", (error) => finish(() => reject(error)));
    child.once("exit", (code) => {
      finish(() => reject(new Error(`Review server exited early (code ${code}): ${stderrBuf.trim()}`)));
    });
  });
}

/** Best-effort: a missing/unavailable opener shouldn't fail the command — the printed URL is still usable. */
function openBrowser(url: string): void {
  const platform = process.platform;
  const [command, args] =
    platform === "darwin"
      ? ["open", [url]]
      : platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : ["xdg-open", [url]];
  try {
    spawn(command, args, { detached: true, stdio: "ignore", windowsHide: true }).unref();
  } catch {
    // No opener available — the caller still gets the URL in the CLI output.
  }
}

/**
 * `diff-review <target>` — M3: spawns a detached, short-lived review server
 * and (unless --no-open) opens it in a browser, then returns immediately.
 * The human reviews and clicks "Review done" whenever they get to it; that
 * POSTs to /save, which writes comments.toon and the server exits on its own.
 */
export const targetCommand: AxiCliCommand<CliContext> = async (args, context) => {
  const cwd = context?.cwd ?? process.cwd();
  const parsed = parseTargetArgs(args);
  const repoRoot = await resolveRepoRoot(resolve(cwd, parsed.target));
  const reviewId = computeReviewId(repoRoot, parsed.baseKey);

  const diffOpts = { base: parsed.base, staged: parsed.staged };
  const [changedFiles, untrackedFiles] = await Promise.all([
    listChangedFiles(repoRoot, diffOpts),
    listUntrackedFiles(repoRoot),
  ]);

  const serverArgs = [repoRoot, parsed.base, parsed.staged ? "1" : "0", reviewId];
  if (parsed.port !== undefined) serverArgs.push(String(parsed.port));

  let url: string;
  try {
    url = await spawnDetachedServer(serverArgs);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AxiError(`Failed to start the review server: ${message}`, "SERVER_START_FAILED", [
      "Run `npm run build` first if dist/frontend/bundle.js is missing",
    ]);
  }

  if (!parsed.noOpen) {
    openBrowser(url);
  }

  return {
    repoRoot,
    baseRef: parsed.baseKey,
    reviewId,
    url,
    changedFiles: [
      ...changedFiles.map((file) => ({ status: file.status, path: file.path, binary: file.binary })),
      ...untrackedFiles.map((path) => ({ status: "untracked" as const, path, binary: false })),
    ],
    note: parsed.noOpen
      ? "Server running — open the URL above in a browser to review."
      : "Server running — a browser should open automatically. If not, open the URL above.",
  };
};
