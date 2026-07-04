import { html as diffToHtml } from "diff2html";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { FilePayload } from "../review/types.js";
import { annotateFile } from "./annotate.js";
import type { CommentEntry, Verdict } from "./comment-state.js";
import type { CommentTarget } from "./types.js";
import { VerdictButtons } from "./VerdictButtons.js";

export interface FileSectionProps {
  file: FilePayload;
  hidden: boolean;
  verdict: Verdict;
  commentEntries: CommentEntry[];
  onSetVerdict: (file: string, verdict: Verdict) => void;
  onOpenForm: (target: CommentTarget, anchorRect: DOMRect) => void;
}

function fileLabel(file: FilePayload): string {
  const prefix = file.status === "untracked" ? "[untracked] " : "";
  return file.oldPath ? `${prefix}${file.oldPath} → ${file.path}` : `${prefix}${file.path}`;
}

export function FileSection({ file, hidden, verdict, commentEntries, onSetVerdict, onOpenForm }: FileSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileButtonRef = useRef<HTMLButtonElement>(null);

  const diffText = expanded ? file.expandedDiff : file.hunkDiff;
  const renderedHtml = useMemo(
    () => diffToHtml(diffText, { outputFormat: "side-by-side", drawFileList: false }),
    [diffText],
  );

  const changeCommentLines = useMemo(
    () =>
      new Set(
        commentEntries
          .filter((entry) => entry.comment.scope === "change" && entry.comment.file === file.path)
          .map((entry) => entry.comment.line),
      ),
    [commentEntries, file.path],
  );
  const fileCommentCount = useMemo(
    () => commentEntries.filter((entry) => entry.comment.scope === "file" && entry.comment.file === file.path).length,
    [commentEntries, file.path],
  );

  // Re-annotate rows every time diff2html's output is swapped in (context toggle).
  useEffect(() => {
    if (containerRef.current) annotateFile(containerRef.current, file.path);
  }, [renderedHtml, file.path]);

  // Mark rows that already have a change-scope comment with a visible dot,
  // so a comment is discoverable where it lives instead of only in the list.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.querySelectorAll<HTMLElement>("tr[data-file][data-line]").forEach((row) => {
      row.classList.toggle("has-comment", changeCommentLines.has(row.dataset.line ?? ""));
    });
  }, [renderedHtml, changeCommentLines]);

  // Delegated click-to-comment on annotated rows — diff2html's markup isn't
  // Preact-managed, so this stays a plain native listener on the container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    function handleClick(event: MouseEvent): void {
      const row = (event.target as HTMLElement).closest<HTMLElement>("tr[data-file][data-line]");
      if (!row?.dataset.file || !row.dataset.line) return;
      onOpenForm({ scope: "change", file: row.dataset.file, line: row.dataset.line }, row.getBoundingClientRect());
    }
    el.addEventListener("click", handleClick);
    return () => el.removeEventListener("click", handleClick);
  }, [onOpenForm]);

  return (
    <section class="review-file" data-file={file.path} data-status={file.status} hidden={hidden}>
      <div class="review-file-toolbar">
        <span class="review-file-label">{fileLabel(file)}</span>
        <button
          ref={fileButtonRef}
          type="button"
          onClick={() =>
            onOpenForm({ scope: "file", file: file.path, line: "" }, fileButtonRef.current!.getBoundingClientRect())
          }
        >
          Comment on file
          {fileCommentCount > 0 && <span class="comment-badge">{fileCommentCount}</span>}
        </button>
        <VerdictButtons verdict={verdict} onChange={(next) => onSetVerdict(file.path, next)} />
        <button type="button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Show hunks only" : "Show full file"}
        </button>
      </div>
      <div ref={containerRef} class="review-file-diff" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
    </section>
  );
}
