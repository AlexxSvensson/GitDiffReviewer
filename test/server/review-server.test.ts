import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createReviewServer, type ReviewServerHandle } from "../../src/server/review-server.js";
import { readCommentsRaw, readMeta, writeMeta } from "../../src/review/store.js";
import type { ReviewPayload } from "../../src/review/types.js";

const samplePayload: ReviewPayload = {
  repoRoot: "/some/repo",
  baseRef: "HEAD",
  reviewId: "test-review",
  files: [],
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("createReviewServer", () => {
  let assetsDir: string;
  let home: string;
  const originalHome = process.env.DIFF_REVIEW_HOME;
  let handle: ReviewServerHandle | undefined;

  beforeEach(async () => {
    assetsDir = await mkdtemp(join(tmpdir(), "diff-review-assets-"));
    await writeFile(join(assetsDir, "bundle.js"), "console.log('bundle');");
    await writeFile(join(assetsDir, "bundle.css"), "body { color: red; }");

    home = await mkdtemp(join(tmpdir(), "diff-review-server-home-"));
    process.env.DIFF_REVIEW_HOME = home;
  });

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
    if (originalHome === undefined) {
      delete process.env.DIFF_REVIEW_HOME;
    } else {
      process.env.DIFF_REVIEW_HOME = originalHome;
    }
    await rm(assetsDir, { recursive: true, force: true });
    await rm(home, { recursive: true, force: true });
  });

  it("binds only to 127.0.0.1", async () => {
    handle = await createReviewServer(samplePayload, "test-review", { assetsDir });
    expect(handle.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
  });

  it("serves the rendered page and bundle assets", async () => {
    handle = await createReviewServer(samplePayload, "test-review", { assetsDir });

    const page = await fetch(handle.url);
    expect(page.status).toBe(200);
    expect(await page.text()).toContain("window.__DIFF_REVIEW__");

    const js = await fetch(new URL("/assets/bundle.js", handle.url));
    expect(js.status).toBe(200);
    expect(await js.text()).toBe("console.log('bundle');");

    const css = await fetch(new URL("/assets/bundle.css", handle.url));
    expect(css.status).toBe(200);
    expect(await css.text()).toBe("body { color: red; }");
  });

  it("404s on any route other than /, /assets/bundle.{js,css}, and /save", async () => {
    handle = await createReviewServer(samplePayload, "test-review", { assetsDir });
    const res = await fetch(new URL("/nope", handle.url));
    expect(res.status).toBe(404);
  });

  it("POST /save writes comments.toon, updates meta.json, and shuts the server down", async () => {
    await writeMeta("test-review", {
      repoRoot: "/some/repo",
      baseRef: "HEAD",
      staged: false,
      createdAt: "2024-01-01T00:00:00.000Z",
      changedFiles: [],
    });
    handle = await createReviewServer(samplePayload, "test-review", { assetsDir });

    const res = await fetch(new URL("/save", handle.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comments: [{ scope: "global", body: "looks good" }] }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const savedComments = await readCommentsRaw("test-review");
    expect(savedComments).toContain("looks good");

    const meta = await readMeta("test-review");
    expect(meta?.savedAt).toBeDefined();

    // The server schedules its own shutdown right after responding — give it
    // a beat, then confirm it actually stopped accepting connections.
    await sleep(50);
    await expect(fetch(handle.url)).rejects.toThrow();
  });

  it("rejects a malformed save body without crashing the server", async () => {
    handle = await createReviewServer(samplePayload, "test-review", { assetsDir });

    const res = await fetch(new URL("/save", handle.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ comments: [{ scope: "bogus", body: "x" }] }),
    });
    expect(res.status).toBe(400);

    // Server should still be up since a validation failure isn't a save.
    const page = await fetch(handle.url);
    expect(page.status).toBe(200);
  });

  it("closes itself after the idle timeout elapses", async () => {
    handle = await createReviewServer(samplePayload, "test-review", { assetsDir, idleTimeoutMs: 30 });
    await sleep(100);
    await expect(fetch(handle.url)).rejects.toThrow();
  });
});
