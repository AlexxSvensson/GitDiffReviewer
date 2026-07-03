import type { Comment } from "../toon/comments.js";

export async function saveComments(comments: Comment[]): Promise<void> {
  const res = await fetch("/save", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ comments }),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error ?? `Save failed with status ${res.status}`);
  }
}
