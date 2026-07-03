#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");
const SKILL_PATH = join(REPO_ROOT, ".claude", "skills", "diff-review", "SKILL.md");

async function loadHomeFacts() {
  try {
    const module = await import(join(REPO_ROOT, "dist", "cli", "home-facts.js"));
    return module.buildHomeFacts();
  } catch (error) {
    console.error("Could not load dist/cli/home-facts.js — run `npm run build` first.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

function renderSkillMarkdown(facts) {
  const commandLines = Object.entries(facts.commands)
    .map(([command, description]) => `- \`${command}\` — ${description}`)
    .join("\n");

  return `---
name: diff-review
description: Open a browser-based review of uncommitted git changes and read back structured human feedback as TOON.
use_when: The user has made a batch of uncommitted edits and wants human sign-off, feedback, or a sanity check before continuing or committing.
---

# diff-review

Lets a human review your uncommitted git changes in a browser and leave scoped
comments — on a specific line, a whole file, or the review as a whole — which
you then read back as structured TOON.

## Workflow

1. Run \`npx -y diff-review-axi <target>\` (target defaults to \`.\`) to open a
   review. This starts a short-lived local server and opens a browser; it does
   not block, so continue with other work while the human reviews.
2. Once the human clicks "Review done" in the browser, run
   \`npx -y diff-review-axi comments <target>\` to read back their comments.

## Commands

${commandLines}
`;
}

async function main() {
  const facts = await loadHomeFacts();
  const generated = renderSkillMarkdown(facts);
  const checkMode = process.argv.includes("--check");

  if (!checkMode) {
    await mkdir(dirname(SKILL_PATH), { recursive: true });
    await writeFile(SKILL_PATH, generated, "utf8");
    console.log(`Wrote ${SKILL_PATH}`);
    return;
  }

  let current;
  try {
    current = await readFile(SKILL_PATH, "utf8");
  } catch {
    console.error(`${SKILL_PATH} is missing. Run \`npm run skill:generate\`.`);
    process.exit(1);
  }
  if (current !== generated) {
    console.error(`${SKILL_PATH} is stale. Run \`npm run skill:generate\` and commit the result.`);
    process.exit(1);
  }
  console.log("SKILL.md is up to date.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
