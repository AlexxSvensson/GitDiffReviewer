import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ReviewMeta {
  repoRoot: string;
  baseRef: string;
  staged: boolean;
  createdAt: string;
  changedFiles: string[];
  port?: number;
  savedAt?: string;
}

/** Overridable via DIFF_REVIEW_HOME so tests never touch the real ~/.diff-review. */
function rootDir(): string {
  return process.env.DIFF_REVIEW_HOME ?? join(homedir(), ".diff-review");
}

export function reviewDir(reviewId: string): string {
  return join(rootDir(), reviewId);
}

export function metaPath(reviewId: string): string {
  return join(reviewDir(reviewId), "meta.json");
}

export function commentsPath(reviewId: string): string {
  return join(reviewDir(reviewId), "comments.toon");
}

async function atomicWrite(path: string, contents: string): Promise<void> {
  const tmpPath = `${path}.tmp`;
  await writeFile(tmpPath, contents, "utf8");
  await rename(tmpPath, path);
}

export async function writeMeta(reviewId: string, meta: ReviewMeta): Promise<void> {
  await mkdir(reviewDir(reviewId), { recursive: true });
  await atomicWrite(metaPath(reviewId), JSON.stringify(meta, null, 2));
}

export async function readMeta(reviewId: string): Promise<ReviewMeta | null> {
  try {
    const raw = await readFile(metaPath(reviewId), "utf8");
    return JSON.parse(raw) as ReviewMeta;
  } catch {
    return null;
  }
}

export async function readCommentsRaw(reviewId: string): Promise<string | null> {
  try {
    return await readFile(commentsPath(reviewId), "utf8");
  } catch {
    return null;
  }
}

export async function writeCommentsRaw(reviewId: string, toonText: string): Promise<void> {
  await mkdir(reviewDir(reviewId), { recursive: true });
  await atomicWrite(commentsPath(reviewId), toonText);
}
