import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestPorts, type TestPorts } from "./adapters.js";
import { setPorts } from "../src/container.js";
import type { Ports } from "../src/ports/index.js";
import { generateSpec } from "../src/tui/spec-gen.js";
import type { Backlog } from "../src/tui/backlog.js";

describe("spec generation", () => {
  let tp: TestPorts;
  let prev: Ports;

  beforeEach(() => {
    tp = createTestPorts({ root: "/repo/myapp" });
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("generates spec for empty backlog", () => {
    const backlog: Backlog = { project: "myapp", tasks: [] };

    generateSpec(backlog);

    const spec = tp.fs.files.get("/repo/myapp/.aflow/spec.md");
    expect(spec).toBeDefined();
    expect(spec).toContain("# Myapp — Spec");
    expect(spec).toContain("No tasks yet");
  });

  test("generates spec with task details", () => {
    const backlog: Backlog = {
      project: "myapp",
      tasks: [{
        id: "t1",
        title: "Build login",
        description: "OAuth2 flow",
        status: "active",
        items: [
          { text: "Design form", done: true },
          { text: "Add validation", done: false },
        ],
        acceptance: ["Users can log in", "Error messages shown"],
        dependencies: [],
        design: null,
        branch: "t1-build-login",
        pr: null,
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: "2024-01-02T00:00:00Z",
        shippedAt: null,
      }],
    };

    generateSpec(backlog);

    const spec = tp.fs.files.get("/repo/myapp/.aflow/spec.md")!;
    expect(spec).toContain("## t1: Build login");
    expect(spec).toContain("**Status:** active");
    expect(spec).toContain("**Branch:** t1-build-login");
    expect(spec).toContain("OAuth2 flow");
    expect(spec).toContain("- [x] Design form");
    expect(spec).toContain("- [ ] Add validation");
    expect(spec).toContain("Users can log in");
    expect(spec).toContain("Error messages shown");
  });

  test("generates spec with dependencies shown", () => {
    const backlog: Backlog = {
      project: "myapp",
      tasks: [{
        id: "t2",
        title: "Add dashboard",
        description: "",
        status: "pending",
        items: [],
        acceptance: [],
        dependencies: ["t1"],
        design: null,
        branch: null,
        pr: null,
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: null,
        shippedAt: null,
      }],
    };

    generateSpec(backlog);

    const spec = tp.fs.files.get("/repo/myapp/.aflow/spec.md")!;
    expect(spec).toContain("**Depends on:** t1");
  });

  test("generates spec with PR link", () => {
    const backlog: Backlog = {
      project: "myapp",
      tasks: [{
        id: "t1",
        title: "Done task",
        description: "",
        status: "shipped",
        items: [],
        acceptance: [],
        dependencies: [],
        design: null,
        branch: "t1-done",
        pr: "https://github.com/org/repo/pull/42",
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: null,
        shippedAt: "2024-01-05T00:00:00Z",
      }],
    };

    generateSpec(backlog);

    const spec = tp.fs.files.get("/repo/myapp/.aflow/spec.md")!;
    expect(spec).toContain("**PR:** https://github.com/org/repo/pull/42");
  });

  test("creates .aflow directory if it doesn't exist", () => {
    const backlog: Backlog = { project: "myapp", tasks: [] };

    generateSpec(backlog);

    expect(tp.fs.dirs.has("/repo/myapp/.aflow")).toBe(true);
  });
});
