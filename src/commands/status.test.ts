import { describe, test, expect, beforeEach, afterAll, spyOn } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { status } from "./status.js";
import {
  createTask,
  transitionTask,
  ensureSetup,
  savePipeline,
  type Phase,
} from "../lib/state.js";
import { gitRoot } from "../lib/git.js";

const stateDir = () => path.join(gitRoot(), ".aflow", "state");
const specsDir = () => path.join(gitRoot(), ".aflow", "specs");

function cleanState() {
  const sd = stateDir();
  const sp = specsDir();
  if (fs.existsSync(sd)) fs.rmSync(sd, { recursive: true });
  if (fs.existsSync(sp)) fs.rmSync(sp, { recursive: true });
}

/** Capture all console.log output during a callback */
function captureLog(fn: () => void): string[] {
  const lines: string[] = [];
  const spy = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
  return lines;
}

/** Run the status command handler directly */
function runStatus(opts: { json?: boolean; verbose?: boolean } = {}) {
  const handler = status.handler as (args: { json: boolean; verbose: boolean }) => void;
  return captureLog(() => handler({ json: opts.json ?? false, verbose: opts.verbose ?? false }));
}

beforeEach(() => {
  cleanState();
});

afterAll(() => {
  cleanState();
});

// ── Verbose flag ────────────────────────────────────────────────────

describe("status --verbose", () => {
  test("shows transition history when verbose is true", () => {
    createTask({ title: "Test task" });
    transitionTask("t1", "design", { actor: "human" });

    const lines = runStatus({ verbose: true });
    const output = lines.join("\n");

    // Should contain the task line
    expect(output).toContain("t1");
    expect(output).toContain("Test task");

    // Should contain transition lines with phase and actor
    expect(output).toContain("understand");
    expect(output).toContain("design");
    expect(output).toContain("human");
  });

  test("hides transition history when verbose is false", () => {
    createTask({ title: "Test task" });
    transitionTask("t1", "design", { actor: "human" });

    const lines = runStatus({ verbose: false });
    const output = lines.join("\n");

    // Should still show the task line
    expect(output).toContain("t1");
    // Should NOT contain actor details (transition history)
    expect(output).not.toContain("(human)");
  });

  test("verbose with no transitions shows no extra lines", () => {
    // A freshly created task has 1 transition (initial phase)
    createTask({ title: "Fresh" });

    const verboseLines = runStatus({ verbose: true });
    const normalLines = runStatus({ verbose: false });

    // Verbose should have more lines (the initial transition)
    expect(verboseLines.length).toBeGreaterThan(normalLines.length);
  });

  test("verbose shows transitions for multiple phases", () => {
    createTask({ title: "Multi-phase" });
    transitionTask("t1", "design", { actor: "think" });
    transitionTask("t1", "implement", { actor: "spec-make" });
    transitionTask("t1", "verify", { actor: "work" });

    const lines = runStatus({ verbose: true });
    const output = lines.join("\n");

    // All phases should appear in transition history
    expect(output).toContain("understand");
    expect(output).toContain("design");
    expect(output).toContain("implement");
    expect(output).toContain("verify");

    // All actors should appear
    expect(output).toContain("think");
    expect(output).toContain("spec-make");
    expect(output).toContain("work");
  });

  test("verbose propagates to child tasks", () => {
    createTask({ title: "Epic" });
    createTask({ title: "Child", parent: "t1" });
    transitionTask("t1-1", "design", { actor: "child-actor" });

    const lines = runStatus({ verbose: true });
    const output = lines.join("\n");

    // Child transition history should also be visible
    expect(output).toContain("child-actor");
  });

  test("verbose does not affect JSON output", () => {
    createTask({ title: "Test task" });
    transitionTask("t1", "design", { actor: "human" });

    const lines = runStatus({ json: true, verbose: true });
    // JSON mode outputs a single JSON blob, verbose flag is ignored
    const parsed = JSON.parse(lines.join(""));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed[0].id).toBe("t1");
  });
});

// ── Default behavior (non-verbose) ──────────────────────────────────

describe("status default", () => {
  test("shows empty message with no tasks", () => {
    const lines = runStatus();
    expect(lines.join("\n")).toContain("No tasks");
  });

  test("shows task with phase", () => {
    createTask({ title: "My task" });
    const lines = runStatus();
    const output = lines.join("\n");
    expect(output).toContain("t1");
    expect(output).toContain("My task");
  });
});
