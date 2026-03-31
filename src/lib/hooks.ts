import path from "node:path";
import { ports } from "../container.js";
import { gitRoot } from "./git.js";

export interface HookEnv {
  WORKTREE_DIR: string;
  WORKTREE_NAME: string;
  BASE_BRANCH: string;
  REPO_ROOT: string;
}

/** Run a hook script if it exists and is executable. */
export function runHook(name: string, env: HookEnv): void {
  const { fs, shell, console: con } = ports();
  const hookFile = path.join(gitRoot(), ".aflow", "hooks", name);
  if (!fs.existsSync(hookFile)) return;

  const stat = fs.statSync(hookFile);
  if (!(stat.mode & 0o111)) return; // not executable

  con.log(`\x1b[36m▸\x1b[0m running ${name} hook...`);
  shell.exec(`bash "${hookFile}"`, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}
