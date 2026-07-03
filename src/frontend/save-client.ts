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

/** Replaces the whole page: the server is already tearing itself down after a successful save. */
export function showSavedMessage(): void {
  document.body.innerHTML = "";
  const message = document.createElement("p");
  message.className = "review-saved-message";
  message.textContent = "Saved — you can close this tab.";
  document.body.append(message);
}
