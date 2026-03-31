import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestPorts, type TestPorts } from "./adapters.js";
import { setPorts } from "../src/container.js";
import type { Ports } from "../src/ports/index.js";
import { COMMANDS, SKILLS } from "../src/skills/index.js";

describe("skills registry", () => {
  test("COMMANDS contains expected skill keys", () => {
    const keys = Object.keys(COMMANDS);
    expect(keys).toContain("work.md");
    expect(keys).toContain("ship.md");
    expect(keys).toContain("think.md");
    expect(keys).toContain("fix.md");
    expect(keys).toContain("qa.md");
    expect(keys).toContain("spec-make.md");
    expect(keys).toContain("spec-refine.md");
    expect(keys).toContain("spec-enrich.md");
    expect(keys).toContain("spec-review.md");
    expect(keys).toContain("spec-lab.md");
    expect(keys).toContain("research-web.md");
    expect(keys).toContain("research-auto.md");
    expect(keys).toContain("work-backlog.md");
  });

  test("SKILLS contains browser skill", () => {
    expect(Object.keys(SKILLS)).toContain("browser.md");
  });

  test("all COMMANDS return non-empty markdown strings", () => {
    for (const [name, content] of Object.entries(COMMANDS)) {
      expect(content.length).toBeGreaterThan(0);
      // All skills should have frontmatter
      expect(content.startsWith("---")).toBe(true);
    }
  });

  test("all SKILLS return non-empty markdown strings", () => {
    for (const [name, content] of Object.entries(SKILLS)) {
      expect(content.length).toBeGreaterThan(0);
    }
  });
});

describe("skills installation", () => {
  let tp: TestPorts;
  let prev: Ports;

  beforeEach(() => {
    tp = createTestPorts({ root: "/repo/aflow" });
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("skills can be written to in-memory filesystem", () => {
    const baseDir = "/repo/aflow/.claude/commands";
    tp.fs.mkdirSync(baseDir, { recursive: true });

    for (const [name, content] of Object.entries(COMMANDS)) {
      const dest = `${baseDir}/${name}`;
      tp.fs.writeFileSync(dest, content);
    }

    // Verify all were written
    for (const name of Object.keys(COMMANDS)) {
      expect(tp.fs.existsSync(`${baseDir}/${name}`)).toBe(true);
    }
  });

  test("skills installation detects up-to-date files", () => {
    const baseDir = "/repo/aflow/.claude/commands";
    tp.fs.mkdirSync(baseDir, { recursive: true });

    // Write first time
    for (const [name, content] of Object.entries(COMMANDS)) {
      tp.fs.writeFileSync(`${baseDir}/${name}`, content);
    }

    // Check they match
    for (const [name, content] of Object.entries(COMMANDS)) {
      const existing = tp.fs.readFileSync(`${baseDir}/${name}`, "utf-8");
      expect(existing).toBe(content);
    }
  });

  test("skills installation detects changed files", () => {
    const baseDir = "/repo/aflow/.claude/commands";
    tp.fs.mkdirSync(baseDir, { recursive: true });

    // Write old version
    tp.fs.writeFileSync(`${baseDir}/work.md`, "old content");

    // Compare with new
    const existing = tp.fs.readFileSync(`${baseDir}/work.md`, "utf-8");
    expect(existing).not.toBe(COMMANDS["work.md"]);
  });
});
