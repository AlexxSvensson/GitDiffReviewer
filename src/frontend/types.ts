import type { CommentScope } from "../toon/comments.js";

export interface CommentTarget {
  scope: CommentScope;
  file: string;
  line: string;
}

export function placeholderFor(target: CommentTarget): string {
  if (target.scope === "change") return `Comment on ${target.file}:${target.line}…`;
  if (target.scope === "file") return `Comment on ${target.file}…`;
  return "Comment on the entire review…";
}
