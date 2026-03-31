import { execFileSync, execSync } from "node:child_process";
import type { ShellPort } from "../ports/shell.js";

/** Real shell adapter — delegates to Node.js child_process. */
export class RealShellAdapter implements ShellPort {
  execFile(
    file: string,
    args: string[],
    options?: { encoding?: string; cwd?: string; timeout?: number; stdio?: unknown },
  ): string {
    return execFileSync(file, args, {
      encoding: "utf-8",
      ...options,
    } as Parameters<typeof execFileSync>[2]).toString().trim();
  }

  exec(
    command: string,
    options?: { cwd?: string; stdio?: unknown; env?: Record<string, string | undefined> },
  ): void {
    execSync(command, options as Parameters<typeof execSync>[1]);
  }

  spawnShell(cwd: string): void {
    const shell = process.env.SHELL || "bash";
    execSync(shell, { cwd, stdio: "inherit" });
  }
}
