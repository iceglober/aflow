export interface WorktreeEntry {
  path: string;
  commit: string;
  branch: string | null;
}

/**
 * Port for all git operations.
 * Abstracts the git CLI so the domain layer never touches child_process.
 */
export interface GitPort {
  /** Run a git command and return trimmed stdout. Throws on failure. */
  run(...args: string[]): string;

  /** Run a git command, returning null on failure instead of throwing. */
  runSafe(...args: string[]): string | null;

  /** Run a git command inside a specific directory. */
  runIn(cwd: string, ...args: string[]): string;

  /** Run a git command in a directory, returning null on failure. */
  runInSafe(cwd: string, ...args: string[]): string | null;

  /** Get the root of the main worktree. */
  root(): string;

  /** Detect the default branch (main/master). */
  defaultBranch(): string;

  /** Parse worktree list into structured entries. */
  listWorktrees(): WorktreeEntry[];
}
