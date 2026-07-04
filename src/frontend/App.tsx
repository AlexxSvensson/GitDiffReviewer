import { useMemo, useState } from "preact/hooks";
import type { ReviewPayload } from "../review/types.js";
import type { Comment } from "../toon/comments.js";
import {
  buildCommentEntries,
  combineComments,
  entriesForTarget,
  type Verdict,
  type VerdictMap,
} from "./comment-state.js";
import { CommentForm } from "./CommentForm.js";
import { CommentsPanel } from "./CommentsPanel.js";
import { FileSection } from "./FileSection.js";
import { matchesFilters, type VerdictFilter } from "./filters.js";
import { saveComments } from "./save-client.js";
import type { CommentTarget } from "./types.js";

interface ActiveForm {
  target: CommentTarget;
  anchorRect: DOMRect;
}

type SaveState = "idle" | "saving" | "saved";

const VERDICT_FILTER_OPTIONS: Array<[VerdictFilter, string]> = [
  ["all", "All files"],
  ["good", "👍 Looks good"],
  ["bad", "👎 Looks bad"],
  ["none", "No verdict yet"],
];

export function App({ payload }: { payload: ReviewPayload }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [verdicts, setVerdicts] = useState<VerdictMap>({});
  const [pathFilter, setPathFilter] = useState("");
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");
  const [activeForm, setActiveForm] = useState<ActiveForm | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showComments, setShowComments] = useState(false);

  const allComments = useMemo(() => combineComments(comments, verdicts), [comments, verdicts]);
  const commentEntries = useMemo(() => buildCommentEntries(comments, verdicts), [comments, verdicts]);
  const globalCommentCount = useMemo(
    () => commentEntries.filter((entry) => entry.comment.scope === "global").length,
    [commentEntries],
  );

  function openForm(target: CommentTarget, anchorRect: DOMRect): void {
    setActiveForm({ target, anchorRect });
  }

  function addComment(comment: Comment): void {
    setComments((prev) => [...prev, comment]);
  }

  function replaceComment(index: number, comment: Comment): void {
    setComments((prev) => prev.map((existing, i) => (i === index ? comment : existing)));
  }

  function removeComment(index: number): void {
    setComments((prev) => prev.filter((_, i) => i !== index));
  }

  function setVerdict(file: string, verdict: Verdict): void {
    setVerdicts((prev) => {
      const next = { ...prev };
      if (verdict === null) delete next[file];
      else next[file] = verdict;
      return next;
    });
  }

  async function handleReviewDone(): Promise<void> {
    setSaveState("saving");
    try {
      await saveComments(allComments);
      setSaveState("saved");
    } catch (error) {
      setSaveState("idle");
      window.alert(error instanceof Error ? error.message : "Failed to save comments.");
    }
  }

  if (saveState === "saved") {
    return <p class="review-saved-message">Saved — you can close this tab.</p>;
  }

  return (
    <>
      <div class="review-toolbar">
        <input
          type="search"
          class="review-path-filter"
          placeholder="Filter by path…"
          value={pathFilter}
          onInput={(event) => setPathFilter((event.target as HTMLInputElement).value)}
        />
        <select
          class="review-verdict-filter"
          value={verdictFilter}
          onChange={(event) => setVerdictFilter((event.target as HTMLSelectElement).value as VerdictFilter)}
        >
          {VERDICT_FILTER_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={(event) =>
            openForm({ scope: "global", file: "", line: "" }, (event.currentTarget as HTMLElement).getBoundingClientRect())
          }
        >
          Comment on entire review
          {globalCommentCount > 0 && <span class="comment-badge">{globalCommentCount}</span>}
        </button>
        <button
          type="button"
          class="review-pending-count"
          aria-expanded={showComments}
          onClick={() => setShowComments((current) => !current)}
        >
          {allComments.length === 1 ? "1 comment" : `${allComments.length} comments`}
          {showComments ? " ▲" : " ▼"}
        </button>
        <button
          type="button"
          class="review-done-button"
          disabled={saveState === "saving"}
          onClick={() => void handleReviewDone()}
        >
          {saveState === "saving" ? "Saving…" : "Review done"}
        </button>
      </div>

      {showComments && (
        <CommentsPanel
          entries={commentEntries}
          onRemoveTyped={removeComment}
          onRemoveVerdict={(file) => setVerdict(file, null)}
        />
      )}

      <div class="review-file-list">
        {payload.files.length === 0 ? (
          <p>No uncommitted changes found.</p>
        ) : (
          payload.files.map((file) => {
            const verdict = verdicts[file.path] ?? null;
            return (
              <FileSection
                key={file.path}
                file={file}
                hidden={!matchesFilters(file, verdict, pathFilter, verdictFilter)}
                verdict={verdict}
                commentEntries={commentEntries}
                onSetVerdict={setVerdict}
                onOpenForm={openForm}
              />
            );
          })
        )}
      </div>

      {activeForm && (
        <CommentForm
          target={activeForm.target}
          anchorRect={activeForm.anchorRect}
          existingEntries={entriesForTarget(commentEntries, activeForm.target)}
          onSubmit={addComment}
          onReplaceTyped={replaceComment}
          onRemoveTyped={removeComment}
          onRemoveVerdict={(file) => setVerdict(file, null)}
          onCancel={() => setActiveForm(null)}
        />
      )}
    </>
  );
}
