import { ports } from "../container.js";

export type { WorktreeEntry } from "../ports/git.js";

/** Run a git command and return trimmed stdout. Throws on failure. */
export function git(...args: string[]): string {
  return ports().git.run(...args);
}

/** Run a git command, returning null on failure instead of throwing. */
export function gitSafe(...args: string[]): string | null {
  return ports().git.runSafe(...args);
}

/** Run a git command inside a specific directory. */
export function gitIn(cwd: string, ...args: string[]): string {
  return ports().git.runIn(cwd, ...args);
}

export function gitInSafe(cwd: string, ...args: string[]): string | null {
  return ports().git.runInSafe(cwd, ...args);
}

/** Spawn an interactive shell in a directory. Returns when the shell exits. */
export function spawnShell(cwd: string): void {
  ports().shell.spawnShell(cwd);
}

/** Get the root of the main worktree (resolves through linked worktrees). */
export function gitRoot(): string {
  return ports().git.root();
}

/** Detect the default branch (main/master). */
export function defaultBranch(): string {
  return ports().git.defaultBranch();
}

/** Parse `git worktree list --porcelain` output into structured entries. */
export function listWorktrees() {
  return ports().git.listWorktrees();
}
