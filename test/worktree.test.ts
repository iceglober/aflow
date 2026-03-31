import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestPorts, type TestPorts } from "./adapters.js";
import { setPorts } from "../src/container.js";
import type { Ports } from "../src/ports/index.js";
import { createWorktree, ensureWorktree } from "../src/lib/worktree.js";
import { worktreePath, isProtected, repoName } from "../src/lib/config.js";
import { gitRoot, defaultBranch, listWorktrees } from "../src/lib/git.js";

describe("worktree creation", () => {
  let tp: TestPorts;
  let prev: Ports;

  beforeEach(() => {
    tp = createTestPorts({ root: "/repo/aflow", defaultBranch: "main" });
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("createWorktree creates a new worktree and returns result", () => {
    const result = createWorktree("feature-x");

    expect(result.name).toBe("feature-x");
    expect(result.base).toBe("main");
    expect(result.wtPath).toContain("feature-x");

    // Verify git commands were called in correct order
    const gitCalls = tp.git.calls.map((c) => c.args.join(" "));
    expect(gitCalls).toContain("fetch origin main --quiet");
    expect(gitCalls.some((c) => c.includes("worktree add -b feature-x"))).toBe(true);
  });

  test("createWorktree uses custom base branch", () => {
    const result = createWorktree("hotfix", "release/v1");

    expect(result.base).toBe("release/v1");

    const gitCalls = tp.git.calls.map((c) => c.args.join(" "));
    expect(gitCalls).toContain("fetch origin release/v1 --quiet");
  });

  test("createWorktree throws if worktree already exists", () => {
    const wtPath = worktreePath("existing");
    tp.fs.dirs.add(wtPath);

    expect(() => createWorktree("existing")).toThrow("Worktree already exists");
  });

  test("createWorktree sets upstream tracking (best-effort)", () => {
    createWorktree("track-test");

    const gitCalls = tp.git.calls.map((c) => c.args.join(" "));
    expect(gitCalls.some((c) => c.includes("branch --set-upstream-to"))).toBe(true);
  });

  test("createWorktree runs post_create hook if present", () => {
    const hookPath = "/repo/aflow/.aflow/hooks/post_create";
    tp.fs.files.set(hookPath, "#!/bin/bash\necho done");
    tp.fs.modes.set(hookPath, 0o755);

    createWorktree("hooked");

    const shellCalls = tp.shell.calls.filter((c) => c.method === "exec");
    expect(shellCalls.length).toBe(1);
    expect(shellCalls[0].args[0]).toContain("post_create");
  });

  test("createWorktree skips hook if not executable", () => {
    const hookPath = "/repo/aflow/.aflow/hooks/post_create";
    tp.fs.files.set(hookPath, "#!/bin/bash\necho done");
    tp.fs.modes.set(hookPath, 0o644); // not executable

    createWorktree("no-hook");

    const shellCalls = tp.shell.calls.filter((c) => c.method === "exec");
    expect(shellCalls.length).toBe(0);
  });

  test("ensureWorktree reuses existing worktree", () => {
    const wtPath = worktreePath("reuse-me");
    tp.fs.dirs.add(wtPath);

    const result = ensureWorktree("reuse-me");
    expect(result).toBe(wtPath);

    // No git commands should be called
    expect(tp.git.calls.length).toBe(0);
  });

  test("ensureWorktree creates if not exists", () => {
    const result = ensureWorktree("new-wt");
    expect(result).toContain("new-wt");

    // Git fetch should have been called
    const gitCalls = tp.git.calls.map((c) => c.args.join(" "));
    expect(gitCalls).toContain("fetch origin main --quiet");
  });
});

describe("config", () => {
  let tp: TestPorts;
  let prev: Ports;

  beforeEach(() => {
    tp = createTestPorts({ root: "/repo/aflow" });
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("worktreePath returns sibling directory", () => {
    const result = worktreePath("my-branch");
    expect(result).toBe("/repo/aflow-wt-my-branch");
  });

  test("worktreePath uses AFLOW_DIR when set", () => {
    const original = process.env.AFLOW_DIR;
    process.env.AFLOW_DIR = "/custom/worktrees";
    try {
      const result = worktreePath("test");
      expect(result).toBe("/custom/worktrees/test");
    } finally {
      if (original !== undefined) {
        process.env.AFLOW_DIR = original;
      } else {
        delete process.env.AFLOW_DIR;
      }
    }
  });

  test("isProtected returns true for main/master", () => {
    expect(isProtected("main")).toBe(true);
    expect(isProtected("master")).toBe(true);
    expect(isProtected("next")).toBe(true);
    expect(isProtected("feature-x")).toBe(false);
  });

  test("repoName returns basename of git root", () => {
    expect(repoName()).toBe("aflow");
  });
});

describe("git delegation", () => {
  let tp: TestPorts;
  let prev: Ports;

  beforeEach(() => {
    tp = createTestPorts({
      root: "/repo/aflow",
      defaultBranch: "main",
      worktrees: [
        { path: "/repo/aflow", branch: "main", commit: "abc1234" },
        { path: "/repo/aflow-wt-feat", branch: "feat", commit: "def5678" },
      ],
    });
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("gitRoot delegates to port", () => {
    expect(gitRoot()).toBe("/repo/aflow");
  });

  test("defaultBranch delegates to port", () => {
    expect(defaultBranch()).toBe("main");
  });

  test("listWorktrees delegates to port", () => {
    const entries = listWorktrees();
    expect(entries.length).toBe(2);
    expect(entries[0].path).toBe("/repo/aflow");
    expect(entries[1].branch).toBe("refs/heads/feat");
  });
});
