/**
 * Port for shell/process execution.
 * Abstracts child_process so hooks and CLI tools can be tested.
 */
export interface ShellPort {
  /** Execute a file with args. Returns trimmed stdout. Throws on failure. */
  execFile(
    file: string,
    args: string[],
    options?: { encoding?: string; cwd?: string; timeout?: number; stdio?: unknown },
  ): string;

  /** Execute a shell command. */
  exec(
    command: string,
    options?: { cwd?: string; stdio?: unknown; env?: Record<string, string | undefined> },
  ): void;

  /** Spawn an interactive shell in a directory. */
  spawnShell(cwd: string): void;
}
