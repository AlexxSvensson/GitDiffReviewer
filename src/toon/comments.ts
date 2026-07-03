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

/** Validates untrusted JSON (e.g. a POST /save body) into well-formed Comment[], throwing on the first defect. */
export function coerceComments(raw: unknown): Comment[] {
  if (!Array.isArray(raw)) {
    throw new Error("Expected comments to be an array");
  }
  return raw.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`comments[${index}] must be an object`);
    }
    const record = entry as Record<string, unknown>;
    const scope = record.scope;
    if (scope !== "change" && scope !== "file" && scope !== "global") {
      throw new Error(`comments[${index}].scope must be "change", "file", or "global"`);
    }
    if (typeof record.body !== "string" || record.body.trim().length === 0) {
      throw new Error(`comments[${index}].body must be a non-empty string`);
    }
    return {
      scope,
      file: typeof record.file === "string" ? record.file : "",
      line: typeof record.line === "string" ? record.line : "",
      body: record.body,
    };
  });
}
