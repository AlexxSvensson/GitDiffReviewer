import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Socket } from "node:net";
import { AxiError } from "axi-sdk-js";
import { coerceComments, encodeComments } from "../toon/comments.js";
import { readMeta, writeCommentsRaw, writeMeta } from "../review/store.js";
import type { ReviewPayload } from "../review/types.js";
import { renderReviewPage } from "./page-template.js";

const DEFAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_SAVE_BODY_BYTES = 10 * 1024 * 1024;

export interface ReviewServerOptions {
  /** undefined/0 = let the OS assign an ephemeral port. */
  port?: number;
  idleTimeoutMs?: number;
  /** Directory containing the built bundle.js/bundle.css (dist/frontend). */
  assetsDir: string;
  /** Called once the server has fully closed (after a save or an idle timeout). */
  onClose?: () => void;
  /** Called once comments.toon has been written by a successful POST /save, before the server starts closing. */
  onSaved?: () => void;
}

export interface ReviewServerHandle {
  url: string;
  close(): Promise<void>;
}

function notFound(res: ServerResponse): void {
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}

function methodNotAllowed(res: ServerResponse): void {
  res.writeHead(405, { "content-type": "text/plain" });
  res.end("Method not allowed");
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_SAVE_BODY_BYTES) {
      throw new AxiError("Request body too large", "PAYLOAD_TOO_LARGE");
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * Starts a loopback-only review server: `GET /` serves the rendered diff
 * page, `GET /assets/*` serves the prebuilt frontend bundle, and `POST /save`
 * writes the submitted comments to disk and schedules the server's own
 * shutdown. There is no other route surface — this is meant to be short-lived
 * and single-purpose (README §9).
 */
export async function createReviewServer(
  payload: ReviewPayload,
  reviewId: string,
  opts: ReviewServerOptions,
): Promise<ReviewServerHandle> {
  const [bundleJs, bundleCss] = await Promise.all([
    readFile(join(opts.assetsDir, "bundle.js")),
    readFile(join(opts.assetsDir, "bundle.css")),
  ]);
  const htmlBuffer = Buffer.from(renderReviewPage(payload, { js: "/assets/bundle.js", css: "/assets/bundle.css" }));

  const sockets = new Set<Socket>();
  let idleTimer: NodeJS.Timeout;
  let closing: Promise<void> | undefined;

  function close(): Promise<void> {
    if (!closing) {
      closing = (async () => {
        clearTimeout(idleTimer);
        for (const socket of sockets) socket.destroy();
        await new Promise<void>((resolve) => server.close(() => resolve()));
        opts.onClose?.();
      })();
    }
    return closing;
  }

  function resetIdleTimer(): void {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => void close(), opts.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS);
  }

  async function handleSave(req: IncomingMessage, res: ServerResponse): Promise<void> {
    let comments;
    try {
      const body = await readRequestBody(req);
      comments = coerceComments(JSON.parse(body).comments);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: message }));
      return;
    }

    await writeCommentsRaw(reviewId, encodeComments(comments));
    const meta = await readMeta(reviewId);
    if (meta) {
      await writeMeta(reviewId, { ...meta, savedAt: new Date().toISOString() });
    }
    opts.onSaved?.();

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    // Let the response flush before tearing the server down.
    setImmediate(() => void close());
  }

  const server: Server = createServer((req, res) => {
    resetIdleTimer();
    const url = req.url ?? "/";
    if (req.method === "GET" && url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(htmlBuffer);
    } else if (req.method === "GET" && url === "/assets/bundle.js") {
      res.writeHead(200, { "content-type": "application/javascript; charset=utf-8" });
      res.end(bundleJs);
    } else if (req.method === "GET" && url === "/assets/bundle.css") {
      res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
      res.end(bundleCss);
    } else if (url === "/save") {
      if (req.method !== "POST") {
        methodNotAllowed(res);
      } else {
        void handleSave(req, res);
      }
    } else {
      notFound(res);
    }
  });

  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // Hardcoded literal — never sourced from config/env/flags, so there is no
    // path that can accidentally bind a wildcard address (README §9).
    server.listen(opts.port ?? 0, "127.0.0.1", () => resolve());
  });
  resetIdleTimer();

  const address = server.address();
  const port = address && typeof address === "object" ? address.port : (opts.port ?? 0);

  return { url: `http://127.0.0.1:${port}/`, close };
}
