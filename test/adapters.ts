import type { GitPort, WorktreeEntry } from "../src/ports/git.js";
import type { FsPort } from "../src/ports/fs.js";
import type { ShellPort } from "../src/ports/shell.js";
import type { ConsolePort } from "../src/ports/console.js";
import type { Ports } from "../src/ports/index.js";

// ─── In-Memory Filesystem ────────────────────────────────────────────

export class InMemoryFs implements FsPort {
  files = new Map<string, string>();
  dirs = new Set<string>();
  modes = new Map<string, number>();

  existsSync(path: string): boolean {
    return this.files.has(path) || this.dirs.has(path);
  }

  readFileSync(path: string, _encoding: BufferEncoding): string {
    const content = this.files.get(path);
    if (content === undefined) throw new Error(`ENOENT: no such file: ${path}`);
    return content;
  }

  writeFileSync(path: string, data: string | Buffer, options?: { mode?: number }): void {
    this.files.set(path, typeof data === "string" ? data : data.toString("utf-8"));
    if (options?.mode !== undefined) {
      this.modes.set(path, options.mode);
    }
  }

  mkdirSync(path: string, _options?: { recursive?: boolean }): void {
    this.dirs.add(path);
  }

  statSync(path: string): { mode: number } {
    if (!this.files.has(path) && !this.dirs.has(path)) {
      throw new Error(`ENOENT: no such file: ${path}`);
    }
    return { mode: this.modes.get(path) ?? 0o644 };
  }

  realpathSync(path: string): string {
    return path;
  }

  accessSync(_path: string, _mode?: number): void {
    // no-op in tests
  }

  renameSync(oldPath: string, newPath: string): void {
    const content = this.files.get(oldPath);
    if (content === undefined) throw new Error(`ENOENT: no such file: ${oldPath}`);
    this.files.set(newPath, content);
    this.files.delete(oldPath);
  }

  chmodSync(path: string, mode: number): void {
    this.modes.set(path, mode);
  }
}

// ─── Fake Git ────────────────────────────────────────────────────────

interface FakeWorktree {
  path: string;
  branch: string;
  commit: string;
}

export class FakeGit implements GitPort {
  /** Scripted responses: key is args joined by space, value is response. */
  responses = new Map<string, string>();
  /** Calls made to run/runSafe/runIn/runInSafe for assertions. */
  calls: { method: string; args: string[]; cwd?: string }[] = [];

  private _root = "/fake/repo";
  private _defaultBranch = "main";
  private _worktrees: FakeWorktree[] = [];

  constructor(opts?: {
    root?: string;
    defaultBranch?: string;
    worktrees?: FakeWorktree[];
  }) {
    if (opts?.root) this._root = opts.root;
    if (opts?.defaultBranch) this._defaultBranch = opts.defaultBranch;
    if (opts?.worktrees) this._worktrees = opts.worktrees;
  }

  /** Set a scripted response for specific git args. */
  when(...args: string[]): { thenReturn(value: string): void; thenThrow(err?: Error): void } {
    const key = args.join(" ");
    return {
      thenReturn: (value: string) => { this.responses.set(key, value); },
      thenThrow: (err?: Error) => { this.responses.set(key, `__THROW__${err?.message ?? "git error"}`); },
    };
  }

  private resolve(args: string[]): string {
    const key = args.join(" ");
    const response = this.responses.get(key);
    if (response !== undefined) {
      if (response.startsWith("__THROW__")) {
        throw new Error(response.slice(9));
      }
      return response;
    }
    // Default: return empty string for unknown commands
    return "";
  }

  run(...args: string[]): string {
    this.calls.push({ method: "run", args });
    return this.resolve(args);
  }

  runSafe(...args: string[]): string | null {
    this.calls.push({ method: "runSafe", args });
    try {
      return this.resolve(args);
    } catch {
      return null;
    }
  }

  runIn(cwd: string, ...args: string[]): string {
    this.calls.push({ method: "runIn", args, cwd });
    return this.resolve(args);
  }

  runInSafe(cwd: string, ...args: string[]): string | null {
    this.calls.push({ method: "runInSafe", args, cwd });
    try {
      return this.resolve(args);
    } catch {
      return null;
    }
  }

  root(): string {
    return this._root;
  }

  defaultBranch(): string {
    return this._defaultBranch;
  }

  listWorktrees(): WorktreeEntry[] {
    return this._worktrees.map((wt) => ({
      path: wt.path,
      commit: wt.commit,
      branch: `refs/heads/${wt.branch}`,
    }));
  }

  /** Add a fake worktree to the list. */
  addWorktree(wt: FakeWorktree): void {
    this._worktrees.push(wt);
  }
}

// ─── Fake Shell ──────────────────────────────────────────────────────

export class FakeShell implements ShellPort {
  calls: { method: string; args: unknown[] }[] = [];
  execFileResponses = new Map<string, string>();

  whenExecFile(file: string, args: string[]): { thenReturn(value: string): void } {
    const key = `${file} ${args.join(" ")}`;
    return {
      thenReturn: (value: string) => { this.execFileResponses.set(key, value); },
    };
  }

  execFile(
    file: string,
    args: string[],
    _options?: { encoding?: string; cwd?: string; timeout?: number; stdio?: unknown },
  ): string {
    this.calls.push({ method: "execFile", args: [file, args] });
    const key = `${file} ${args.join(" ")}`;
    return this.execFileResponses.get(key) ?? "";
  }

  exec(
    command: string,
    _options?: { cwd?: string; stdio?: unknown; env?: Record<string, string | undefined> },
  ): void {
    this.calls.push({ method: "exec", args: [command] });
  }

  spawnShell(cwd: string): void {
    this.calls.push({ method: "spawnShell", args: [cwd] });
  }
}

// ─── Capturing Console ──────────────────────────────────────────────

export class CapturingConsole implements ConsolePort {
  logs: string[] = [];
  errors: string[] = [];

  log(message: string): void {
    this.logs.push(message);
  }

  error(message: string): void {
    this.errors.push(message);
  }
}

// ─── Test Ports Factory ─────────────────────────────────────────────

export interface TestPorts extends Ports {
  git: FakeGit;
  fs: InMemoryFs;
  shell: FakeShell;
  console: CapturingConsole;
}

export function createTestPorts(opts?: {
  root?: string;
  defaultBranch?: string;
  worktrees?: FakeWorktree[];
}): TestPorts {
  return {
    git: new FakeGit(opts),
    fs: new InMemoryFs(),
    shell: new FakeShell(),
    console: new CapturingConsole(),
  };
}
