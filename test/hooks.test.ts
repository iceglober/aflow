import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestPorts, type TestPorts } from "./adapters.js";
import { setPorts } from "../src/container.js";
import type { Ports } from "../src/ports/index.js";
import { runHook } from "../src/lib/hooks.js";

describe("hooks", () => {
  let tp: TestPorts;
  let prev: Ports;

  const env = {
    WORKTREE_DIR: "/repo/aflow-wt-test",
    WORKTREE_NAME: "test",
    BASE_BRANCH: "main",
    REPO_ROOT: "/repo/aflow",
  };

  beforeEach(() => {
    tp = createTestPorts({ root: "/repo/aflow" });
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("runHook executes hook when file exists and is executable", () => {
    const hookPath = "/repo/aflow/.aflow/hooks/post_create";
    tp.fs.files.set(hookPath, "#!/bin/bash\necho done");
    tp.fs.modes.set(hookPath, 0o755);

    runHook("post_create", env);

    const execCalls = tp.shell.calls.filter((c) => c.method === "exec");
    expect(execCalls.length).toBe(1);
    expect(String(execCalls[0].args[0])).toContain("post_create");
  });

  test("runHook does nothing when hook file doesn't exist", () => {
    runHook("post_create", env);

    const execCalls = tp.shell.calls.filter((c) => c.method === "exec");
    expect(execCalls.length).toBe(0);
  });

  test("runHook does nothing when hook is not executable", () => {
    const hookPath = "/repo/aflow/.aflow/hooks/post_create";
    tp.fs.files.set(hookPath, "#!/bin/bash\necho done");
    tp.fs.modes.set(hookPath, 0o644);

    runHook("post_create", env);

    const execCalls = tp.shell.calls.filter((c) => c.method === "exec");
    expect(execCalls.length).toBe(0);
  });

  test("runHook logs before executing", () => {
    const hookPath = "/repo/aflow/.aflow/hooks/post_create";
    tp.fs.files.set(hookPath, "#!/bin/bash\necho done");
    tp.fs.modes.set(hookPath, 0o755);

    runHook("post_create", env);

    expect(tp.console.logs.some((l) => l.includes("post_create"))).toBe(true);
  });
});
