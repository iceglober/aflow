import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestPorts, type TestPorts } from "./adapters.js";
import { setPorts } from "../src/container.js";
import type { Ports } from "../src/ports/index.js";
import { pullMain, checkPrStatus } from "../src/tui/git-sync.js";

describe("git-sync", () => {
  let tp: TestPorts;
  let prev: Ports;

  beforeEach(() => {
    tp = createTestPorts();
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("pullMain returns true on success", () => {
    tp.git.when("pull", "--ff-only", "origin", "main").thenReturn("");

    expect(pullMain()).toBe(true);
  });

  test("pullMain returns false on failure", () => {
    tp.git.when("pull", "--ff-only", "origin", "main").thenThrow(new Error("conflict"));

    expect(pullMain()).toBe(false);
  });

  test("checkPrStatus returns merged for MERGED response", () => {
    tp.shell.whenExecFile("gh", [
      "pr", "view", "https://github.com/org/repo/pull/1",
      "--json", "state", "-q", ".state",
    ]).thenReturn("MERGED");

    expect(checkPrStatus("https://github.com/org/repo/pull/1")).toBe("merged");
  });

  test("checkPrStatus returns open for OPEN response", () => {
    tp.shell.whenExecFile("gh", [
      "pr", "view", "https://github.com/org/repo/pull/2",
      "--json", "state", "-q", ".state",
    ]).thenReturn("OPEN");

    expect(checkPrStatus("https://github.com/org/repo/pull/2")).toBe("open");
  });

  test("checkPrStatus returns closed for CLOSED response", () => {
    tp.shell.whenExecFile("gh", [
      "pr", "view", "https://github.com/org/repo/pull/3",
      "--json", "state", "-q", ".state",
    ]).thenReturn("CLOSED");

    expect(checkPrStatus("https://github.com/org/repo/pull/3")).toBe("closed");
  });

  test("checkPrStatus returns unknown on unexpected response", () => {
    tp.shell.whenExecFile("gh", [
      "pr", "view", "https://github.com/org/repo/pull/4",
      "--json", "state", "-q", ".state",
    ]).thenReturn("DRAFT");

    expect(checkPrStatus("https://github.com/org/repo/pull/4")).toBe("unknown");
  });

  test("checkPrStatus returns unknown on error", () => {
    // No response configured = will return "" which is "unknown"
    expect(checkPrStatus("https://github.com/org/repo/pull/99")).toBe("unknown");
  });
});
