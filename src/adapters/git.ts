import { execFileSync } from "node:child_process";
import path from "node:path";
import type { GitPort, WorktreeEntry } from "../ports/git.js";

/** Real git adapter — calls the git CLI via execFileSync. */
export class RealGitAdapter implements GitPort {
  run(...args: string[]): string {
    return execFileSync("git", args, { encoding: "utf-8" }).trim();
  }

  runSafe(...args: string[]): string | null {
    try {
      return execFileSync("git", args, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      return null;
    }
  }

  runIn(cwd: string, ...args: string[]): string {
    return execFileSync("git", args, { encoding: "utf-8", cwd }).trim();
  }

  runInSafe(cwd: string, ...args: string[]): string | null {
    try {
      return execFileSync("git", args, {
        encoding: "utf-8",
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
      }).trim();
    } catch {
      return null;
    }
  }

  root(): string {
    const commonDir = this.run("rev-parse", "--git-common-dir");
    if (commonDir === ".git" || commonDir.endsWith("/.git")) {
      return this.run("rev-parse", "--show-toplevel");
    }
    return path.dirname(commonDir);
  }

  defaultBranch(): string {
    const ref = this.runSafe("symbolic-ref", "refs/remotes/origin/HEAD");
    if (ref) {
      return ref.replace("refs/remotes/origin/", "");
    }

    for (const name of ["main", "master"]) {
      if (this.runSafe("show-ref", "--verify", `refs/remotes/origin/${name}`) !== null) {
        return name;
      }
    }

    for (const name of ["main", "master"]) {
      if (this.runSafe("show-ref", "--verify", `refs/heads/${name}`) !== null) {
        return name;
      }
    }

    throw new Error(
      "Cannot detect default branch. Set it with: git remote set-head origin <branch>",
    );
  }

  listWorktrees(): WorktreeEntry[] {
    const raw = this.run("worktree", "list", "--porcelain");
    const entries: WorktreeEntry[] = [];
    let current: Partial<WorktreeEntry> = {};

    for (const line of raw.split("\n")) {
      if (line === "") {
        if (current.path) {
          entries.push({
            path: current.path,
            commit: current.commit ?? "",
            branch: current.branch ?? null,
          });
        }
        current = {};
        continue;
      }

      if (line.startsWith("worktree ")) current.path = line.slice(9);
      else if (line.startsWith("HEAD ")) current.commit = line.slice(5);
      else if (line.startsWith("branch ")) current.branch = line.slice(7);
    }

    if (current.path) {
      entries.push({
        path: current.path,
        commit: current.commit ?? "",
        branch: current.branch ?? null,
      });
    }

    return entries;
  }
}
