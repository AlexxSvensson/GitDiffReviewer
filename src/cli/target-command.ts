import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AxiError, type AxiCliCommand } from "axi-sdk-js";
import { listChangedFiles, listUntrackedFiles } from "../git/diff.js";
import { resolveRepoRoot } from "../git/repo.js";
import { computeReviewId } from "../review/hash.js";
import { readCommentsRaw } from "../review/store.js";
import type { CliContext } from "./context.js";
import { parseTargetArgs } from "./target-args.js";

const SERVER_ENTRY = join(dirname(fileURLToPath(import.meta.url)), "server-entry.js");
const HANDSHAKE_TIMEOUT_MS = 5000;

interface DetachedServerHandle {
  url: string;
  /** Resolves once the server prints "SAVED"; rejects if it exits/errors first. Only meaningful when spawned with keepStdioOpen. */
  saved: Promise<void>;
}

/**
 * Spawns the review server as a detached child and resolves once it prints
 * its "LISTENING <url>" handshake line.
 *
 * Normally (`keepStdioOpen: false`) the piped stdio is destroyed right after
 * the handshake, so this process holds no open handle to the child — the
 * child (detached + unref'd) keeps running as the server on its own, and this
 * process is free to exit immediately (README: "agenten hänger inte kvar").
 *
 * With `keepStdioOpen: true` (used by `--wait`) the stdio is left open past
 * the handshake so the caller can keep reading it for the later "SAVED" line
 * the server prints once a review has been submitted — the returned `saved`
 * promise resolves on that line, or rejects if the child exits first (idle
 * timeout, crash) without ever printing it.
 */
function spawnDetachedServer(args: string[], keepStdioOpen: boolean): Promise<DetachedServerHandle> {
  return new Promise((resolveHandshake, rejectHandshake) => {
    const child = spawn(process.execPath, [SERVER_ENTRY, ...args], {
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    let handshakeSettled = false;
    let savedSeen = false;
    let resolveSaved!: () => void;
    let rejectSaved!: (error: Error) => void;
    const saved = new Promise<void>((res, rej) => {
      resolveSaved = res;
      rejectSaved = rej;
    });

    const timeout = setTimeout(() => {
      settleHandshake(() => {
        child.kill();
        rejectHandshake(new Error("Timed out waiting for the review server to start"));
      });
    }, HANDSHAKE_TIMEOUT_MS);

    function releaseStdio(): void {
      child.stdout?.destroy();
      child.stderr?.destroy();
      child.unref();
    }

    function settleHandshake(action: () => void): void {
      if (handshakeSettled) return;
      handshakeSettled = true;
      clearTimeout(timeout);
      if (!keepStdioOpen) releaseStdio();
      action();
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString();
      if (!handshakeSettled) {
        const match = stdoutBuf.match(/^LISTENING (\S+)/m);
        if (match) settleHandshake(() => resolveHandshake({ url: match[1], saved }));
      }
      if (keepStdioOpen && !savedSeen && /^SAVED\s*$/m.test(stdoutBuf)) {
        savedSeen = true;
        releaseStdio();
        resolveSaved();
      }
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString();
    });
    child.once("error", (error) => {
      settleHandshake(() => rejectHandshake(error));
      if (!savedSeen) rejectSaved(error);
    });
    child.once("exit", (code) => {
      settleHandshake(() => rejectHandshake(new Error(`Review server exited early (code ${code}): ${stderrBuf.trim()}`)));
      if (!savedSeen) rejectSaved(new Error(`Review server exited before saving (code ${code}): ${stderrBuf.trim()}`));
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
 *
 * `--wait` opts into a different, blocking mode: instead of returning
 * immediately, the command stays attached to the server and only returns once
 * the human has clicked "Review done", printing the saved comments as TOON
 * directly — the same content `diff-review comments <target>` would read
 * back, without a separate call. Meant to be run as a backgrounded command so
 * the agent isn't frozen while the human reviews.
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

  let handle: DetachedServerHandle;
  try {
    handle = await spawnDetachedServer(serverArgs, parsed.wait);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AxiError(`Failed to start the review server: ${message}`, "SERVER_START_FAILED", [
      "Run `npm run build` first if dist/frontend/bundle.js is missing",
    ]);
  }

  if (!parsed.noOpen) {
    openBrowser(handle.url);
  }

  if (parsed.wait) {
    try {
      await handle.saved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AxiError(`Review ended without saving: ${message}`, "REVIEW_NOT_SAVED", [
        'Run `diff-review <target> --wait` again and click "Review done" before it exits',
      ]);
    }
    const raw = await readCommentsRaw(reviewId);
    if (raw === null) {
      throw new AxiError("Review server reported a save but no comments.toon was found", "NOT_FOUND");
    }
    return raw;
  }

  return {
    repoRoot,
    baseRef: parsed.baseKey,
    reviewId,
    url: handle.url,
    changedFiles: [
      ...changedFiles.map((file) => ({ status: file.status, path: file.path, binary: file.binary })),
      ...untrackedFiles.map((path) => ({ status: "untracked" as const, path, binary: false })),
    ],
    note: parsed.noOpen
      ? "Server running — open the URL above in a browser to review."
      : "Server running — a browser should open automatically. If not, open the URL above.",
  };
};
