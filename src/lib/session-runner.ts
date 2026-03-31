import { execFileSync, execSync } from "node:child_process";

/** Find the system-installed Claude Code CLI path. */
function findClaudeCli(): string {
  try {
    const p = execFileSync("which", ["claude"], { encoding: "utf-8" }).trim();
    if (p) return p;
  } catch {}
  throw new Error("Claude CLI not found. Install it from https://claude.ai/download");
}

export interface RunSessionOpts {
  /** Working directory for the session */
  cwd: string;
  /** Prompt to send (e.g., `/spec-make <args>`) */
  prompt: string;
  /** If true, inherit stdin/stdout for interactive sessions */
  interactive?: boolean;
}

/**
 * Spawn a Claude Code session as a subprocess.
 *
 * Interactive sessions (understand, design) inherit stdin/stdout so the user
 * can converse with Claude. Autonomous sessions (implement, verify, ship) run
 * with output piped.
 *
 * Returns the exit code.
 */
export function runSession(opts: RunSessionOpts): number {
  const claude = findClaudeCli();

  try {
    if (opts.interactive) {
      // Interactive: user converses with Claude directly (stdin/stdout inherited)
      execSync(
        `${JSON.stringify(claude)} --prompt ${JSON.stringify(opts.prompt)}`,
        {
          cwd: opts.cwd,
          stdio: "inherit",
          encoding: "utf-8",
        },
      );
      return 0;
    } else {
      // Autonomous: non-interactive, pipe stdin, show stdout/stderr
      execSync(
        `${JSON.stringify(claude)} -p ${JSON.stringify(opts.prompt)}`,
        {
          cwd: opts.cwd,
          stdio: ["pipe", "inherit", "inherit"],
          encoding: "utf-8",
        },
      );
      return 0;
    }
  } catch (e: any) {
    // execSync throws on non-zero exit
    return e.status ?? 1;
  }
}
