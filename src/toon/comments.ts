import { decode, encode } from "@toon-format/toon";

export type CommentScope = "change" | "file" | "global";

export interface Comment {
  scope: CommentScope;
  /** Empty string when scope === "global". */
  file: string;
  /** Empty string when scope !== "change". */
  line: string;
  body: string;
}

export function encodeComments(comments: Comment[]): string {
  return encode({ comments }, { indent: 2 });
}

export function decodeComments(toonText: string): Comment[] {
  const decoded = decode(toonText) as { comments?: unknown };
  if (!Array.isArray(decoded.comments)) {
    return [];
  }
  return decoded.comments.map((entry) => {
    const record = entry as Record<string, unknown>;
    return {
      scope: record.scope as CommentScope,
      file: String(record.file ?? ""),
      line: String(record.line ?? ""),
      body: String(record.body ?? ""),
    };
  });
}
