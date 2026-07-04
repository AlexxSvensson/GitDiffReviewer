# diff-review-axi — original design spec

> This is the original pre-implementation planning document, translated from
> the Swedish notes written before any code existed. It's preserved here as a
> historical record of the design rationale — why things were built the way
> they were. For how the tool actually works today, see [README.md](../README.md).

---

## 1. Background & why

Current workflow: once Claude Code has made changes, you need to commit and
check git (or read long replies/screenshots) to see what changed. The goal is
to skip that — see all diffs directly in a good view, comment on them, and
send the comments back to the agent.

The idea is inspired by **lavish-axi** (`github.com/kunchenguid/lavish-axi`),
which does exactly this pattern but for HTML artifacts: a CLI opens a local
web window, the human annotates, the agent fetches the feedback. This tool
does the same core idea but aimed at **git diffs** instead of HTML.

## 2. What AXI is (short)

AXI = Agent eXperience Interface. A design philosophy for CLI tools built to
be driven by AI agents rather than humans. Core principles relevant here:

- **TOON output** on stdout (Token-Oriented Object Notation) instead of JSON —
  ~40% fewer tokens. Field names are declared once in a header, then just
  values per row. Format: `name[N]{fields}:` followed by indented value rows.
- **Structured errors** to stdout (not stderr), with actionable suggestions.
- **Exit codes**: 0 = success, 1 = error, 2 = usage error.
- **No interactive prompts** — everything via flags.
- **Contextual disclosure** — suggest next-step commands after output.
- **Home view** with no arguments: shows the tool's path (with `~`), a
  one-line description, and any active state.

## 3. Chosen architecture (Path 2, simplified)

Three paths were considered during discussion:

- **Path 1** — build on top of lavish-axi (render the diff as HTML, open with
  `lavish-axi`). Least work, inherits everything "hard" (server, polling,
  annotations), but lavish's annotation model points at DOM elements, not
  `file:line`, which doesn't fit diff review well.
- **Path 2** — build a standalone AXI. More code, full control over the data
  model.
- **Middle path** — prototype Path 1 first, build Path 2 if the annotation
  model chafes.

**Decision: Path 2**, but with one **deliberately relaxed requirement**: the
agent does NOT need to block and wait for the review (no long-poll). That
removes the hardest part.

The flow becomes asynchronous via the filesystem:

1. The agent runs `diff-review <target>` → starts a short-lived local server
   on `127.0.0.1`, opens the browser, shows the diffs. The agent doesn't stick
   around.
2. The human reviews whenever they want, writes comments, clicks "review
   done".
3. "Review done" does `POST /save` → the server writes the comments to disk
   (e.g. `~/.diff-review/<hash>/comments.toon`) and shuts itself down.
4. Next time the agent runs, it reads `diff-review comments <target>` → reads
   the file → renders it as TOON.

No long-lived server, no session liveness, no feedback queue. The server just
"receives a POST and dies."

> Alternative with no server at all: an "Export" button in the HTML downloads
> a `.toon`/`.json` file via blob (`URL.createObjectURL`). Simpler but
> requires a manual download step. The small server gives better UX for
> ~20 lines of server code, so it was preferred.

## 4. Functional requirements (locked)

### Diff view
- **Side-by-side like VS Code**: old code on the left, new code on the right.
- Based on **uncommitted git changes** — `git diff HEAD` (working tree + any
  staged changes vs. the latest commit). See the note below about exact
  variants.
- **Line numbers shown** (both sides).

### View selection — how much context is shown per diff
You should be able to choose which diff you're looking at and how much
surrounding code is shown around a change, to get a sense of the code around
it. Levels:

1. **Just the hunks** (default) — what git gives, with a few lines of
   context.
2. **More context** — expand the number of unchanged lines shown around each
   hunk (e.g. via `git diff -U<n>` with a larger `n`, or expand incrementally
   in the UI with "show more lines" buttons between/around the hunks).
3. **Whole file** — show the entire file content with changes highlighted.

All three are easy to build — it's just about how many unchanged lines get
rendered, not about understanding the code's structure.

### Filtering (frontend-only, no backend)
- Filter what you want to *see*: e.g. only certain files, path search, hide
  unchanged. (Exact set not locked — designed in the frontend.)

### Comments — three scopes
Maps directly to the data model (example files below are illustrative):

| scope    | has file | has line | meaning                                    |
|----------|----------|----------|---------------------------------------------|
| `change` | yes      | yes      | comment on a specific line/change            |
| `file`   | yes      | no       | comment on an entire file                    |
| `global` | no       | no       | comment on the whole review (all diffs)      |

## 5. Data model (TOON)

Comments handed back to the agent:

```
comments[3]{scope,file,line,body}:
  change,src/models.py,42,"Missing index on FK"
  file,src/views.py,,"The whole file needs a refactor"
  global,,,"The migration looks good, one question about timezone handling"
```

- `scope` ∈ `change` | `file` | `global`
- `change` → file + line filled in
- `file` → just file
- `global` → neither file nor line
- Rendered by the SDK's `renderOutput()` — you keep dicts/objects in code and
  encode to TOON on output.

## 6. Building blocks & dependencies

### axi-sdk-js (`^0.1.8`) — gives us for free:
Inspected contents (modules: `cli`, `errors`, `hooks`, `output`, `update`):

- `runAxiCli(options)` — command router. You give it a `commands` map, a
  `home` handler, `topLevelHelp`; it handles argv, unknown commands, help,
  exit codes.
- `output` module — `renderOutput()`, `errorOutput()`, `homeHeaderOutput()`,
  `collapseHomeDirectory()`, `renderHomeHeader()`. TOON formatting + home
  view.
- `errors` module — `AxiError(message, code, suggestions)` +
  `exitCodeForError()`. Structured errors with correct exit codes.
- `hooks` module — `installSessionStartHooks()` writes SessionStart hooks to
  Claude Code / Codex / OpenCode, idempotently, with path repair.
  (= `setup hooks`.)
- `update` module — the entire self-update flow (`runUpdate`,
  `fetchLatestVersion`, `detectInstallMethod`, `planUpgrade`).
- Only dependency: `@toon-format/toon` (`^2.1.0`).

### IMPORTANT — what the SDK does NOT give us:
**No server, no long-poll, no session model, no browser SDK, no feedback
queue.** lavish built all of that itself on top of the SDK. Matters less for
us since we've deliberately skipped poll/waiting — but the save server
(POST → write file → close) and the whole frontend are ours to write.

### diff2html
Mature JS library that renders a unified diff into a nice view. Supports
**side-by-side** and inline. This solves most of the diff rendering. You feed
it `git diff` output (unified format) and get HTML back.
- Repo: `github.com/rtfpessoa/diff2html`
- Check that side-by-side + line numbers + "expand context"/show whole file
  are supported in the chosen version; otherwise supplement with custom logic
  to fetch full file content and show unchanged lines.

### TOON
- Spec: `github.com/toon-format/spec` (working draft, was v3.2 at the time of
  discussion).
- The SDK pulls in `@toon-format/toon`. **Lock the version** — the spec is
  young and implementations may be incompatible across spec versions.

## 7. Command surface (proposal)

| Command                          | Description                                          |
|-----------------------------------|-------------------------------------------------------|
| `diff-review`                     | Home view: path, description, any recent review.      |
| `diff-review <target>`            | Render uncommitted diffs → open browser + server.      |
| `diff-review comments <target>`   | Read back saved comments as TOON.                      |
| `diff-review setup hooks`         | Install SessionStart hooks (via SDK).                  |
| `diff-review update`              | Self-update (via SDK, built-in).                       |

Flags to consider: `--staged` / `--base <ref>` for what the diff is compared
against, `--no-open` (create without opening the browser), `--port`.

## 7b. Distribution as an Agent Skill

Primary delivery method. An AXI is just a CLI, and the skill teaches the
agent how to run it (e.g. via `npx -y <package>`), so the CLI comes along on
demand without an npm install.

- **SKILL.md** with frontmatter (name, description, `use_when` triggers) that
  teaches the agent the workflow: run `<tool> <target>` to open a review, run
  `<tool> comments <target>` to read back comments.
- The skill should be generated from the same source as the home view
  (single source of truth), so the guidance doesn't drift from the CLI's own
  output. Add a `--check` build step in CI that fails if the committed
  SKILL.md is stale.
- The skill is static — omit dynamic state (open sessions etc.).
- Installed in the project's skills directory by default (`.claude/skills/`),
  or globally (`~/.claude/skills/`) with `-g`.
- Optional SessionStart hook (via the SDK's `installSessionStartHooks()`) for
  ambient context in every session; hook + skill are complementary.

## 8. Things to sort out before/during coding

- **Exact git diff source**: `git diff` (working tree vs. index), `git diff
  HEAD` (everything uncommitted vs. latest commit), or `git diff --staged`?
  The requirement says "uncommitted" → probably `git diff HEAD`, but confirm
  whether staged should be included. Consider a flag to choose the base.
- **Level 3 — "show whole file"**: diff2html only shows hunks; expanding to
  the whole file requires reading the file content (new side from the
  working tree, old side via `git show HEAD:<path>`) and filling in unchanged
  lines with line numbers. Simple.
- **Level 2 — "more context"**: two ways, both simple. Either run `git diff`
  with a larger `-U<n>` (more context lines per hunk) and re-render, or —
  smoother in the UI — add "show more lines" buttons in the gaps
  between/around the hunks that fetch the missing unchanged lines from the
  file content (same sources as level 3). No understanding of code structure
  needed; it's just more lines.
- **Line number mapping for `change` comments**: put `data-file` and
  `data-line` (and possibly `data-side` for old/new) on every row element in
  the DOM, so a clicked row can be translated into a `file:line` for the
  comment.
- **Binary files / renames / deleted files**: handle in the diff parsing.
- **Large diffs**: rendering performance; possibly lazy-render per file.

## 9. Security (important — internal/customer-facing code)

- **Only bind to loopback** (`127.0.0.1`). A wildcard bind (`0.0.0.0`)
  exposes an unauthenticated server that can read/serve local files —
  unsuitable for internal or sensitive code. (Same warning applies to
  lavish.)
- **No external sharing** of diffs (the equivalent of `lavish-axi share` →
  third-party ht-ml.app is out of the question for internal code).
- The server should be short-lived and shut itself down after save/idle.

## 10. Stack context

- Node for the AXI (the SDK is Node/TS).
- Diffs are fetched from git in the repo where the tool is run.
- Distributed as an **Agent Skill** (Agent Skills format), plus an optional
  global npm install for SessionStart hooks — like other AXIs (e.g. lavish).

## 11. Next steps when coding begins

1. Skeleton: `runAxiCli()` with `home` + `<target>` + `comments` + `setup
   hooks`.
2. Git layer: fetch unified diff + (for whole-file) full old/new content.
3. Frontend: diff2html side-by-side, line numbers, `data-file`/`data-line`,
   filtering. Three-level view selection: hunk (default) / more context
   (larger `-U<n>` or "show more lines" buttons) / whole file.
4. Comment UI: three scopes (change / file / global).
5. Save server: `POST /save` → write `comments.toon` → close.
6. `comments` command: read file → `renderOutput()` as TOON.
7. Security: loopback bind, short-lived server.
