import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { AxiError } from "axi-sdk-js";

const execFileAsync = promisify(execFile);

export async function resolveRepoRoot(cwd: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd });
    return stdout.trim();
  } catch {
    throw new AxiError(`Not a git repository: ${cwd}`, "NOT_A_GIT_REPO", [
      "Run this command from inside a git repository",
      "Or pass a path that is inside one",
    ]);
  }
}
