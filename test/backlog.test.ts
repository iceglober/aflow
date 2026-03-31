import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { createTestPorts, type TestPorts } from "./adapters.js";
import { setPorts } from "../src/container.js";
import type { Ports } from "../src/ports/index.js";
import {
  loadBacklog,
  saveBacklog,
  addTask,
  updateTask,
  deleteTask,
  moveTaskUp,
  moveTaskDown,
  dependenciesMet,
  nextPendingTask,
  type Backlog,
  type Task,
} from "../src/tui/backlog.js";

describe("backlog", () => {
  let tp: TestPorts;
  let prev: Ports;

  beforeEach(() => {
    tp = createTestPorts({ root: "/repo/myproject" });
    prev = setPorts(tp);
  });

  afterEach(() => {
    setPorts(prev);
  });

  test("loadBacklog returns empty backlog when no file exists", () => {
    const backlog = loadBacklog();
    expect(backlog.project).toBe("myproject");
    expect(backlog.tasks).toEqual([]);
  });

  test("loadBacklog reads existing backlog from disk", () => {
    const data: Backlog = {
      project: "myproject",
      tasks: [{
        id: "t1",
        title: "First task",
        description: "Do something",
        status: "pending",
        items: [],
        acceptance: [],
        dependencies: [],
        design: null,
        branch: null,
        pr: null,
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: null,
        shippedAt: null,
      }],
    };
    tp.fs.files.set("/repo/myproject/.aflow/backlog.json", JSON.stringify(data));

    const backlog = loadBacklog();
    expect(backlog.tasks.length).toBe(1);
    expect(backlog.tasks[0].title).toBe("First task");
  });

  test("loadBacklog backfills missing dependencies field", () => {
    const data = {
      project: "myproject",
      tasks: [{
        id: "t1",
        title: "Old task",
        description: "",
        status: "pending",
        items: [],
        acceptance: [],
        // no dependencies field
        design: null,
        branch: null,
        pr: null,
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: null,
        shippedAt: null,
      }],
    };
    tp.fs.files.set("/repo/myproject/.aflow/backlog.json", JSON.stringify(data));

    const backlog = loadBacklog();
    expect(backlog.tasks[0].dependencies).toEqual([]);
  });

  test("saveBacklog writes JSON and generates spec", () => {
    const backlog: Backlog = {
      project: "myproject",
      tasks: [{
        id: "t1",
        title: "Task One",
        description: "Description here",
        status: "pending",
        items: [{ text: "Sub-item", done: false }],
        acceptance: ["It works"],
        dependencies: [],
        design: null,
        branch: null,
        pr: null,
        createdAt: "2024-01-01T00:00:00Z",
        startedAt: null,
        shippedAt: null,
      }],
    };

    saveBacklog(backlog);

    // Verify backlog.json was written
    const written = tp.fs.files.get("/repo/myproject/.aflow/backlog.json");
    expect(written).toBeDefined();
    const parsed = JSON.parse(written!);
    expect(parsed.tasks[0].title).toBe("Task One");

    // Verify spec.md was also generated
    const spec = tp.fs.files.get("/repo/myproject/.aflow/spec.md");
    expect(spec).toBeDefined();
    expect(spec).toContain("Task One");
    expect(spec).toContain("It works");
  });

  test("addTask creates a task with auto-incremented id", () => {
    const backlog = loadBacklog();
    const task = addTask(backlog, {
      title: "New feature",
      description: "Build something cool",
    });

    expect(task.id).toBe("t1");
    expect(task.status).toBe("pending");
    expect(backlog.tasks.length).toBe(1);
  });

  test("addTask increments id based on existing tasks", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "First", description: "" });
    addTask(backlog, { title: "Second", description: "" });
    const third = addTask(backlog, { title: "Third", description: "" });

    expect(third.id).toBe("t3");
  });

  test("addTask includes items, acceptance, and dependencies", () => {
    const backlog = loadBacklog();
    const task = addTask(backlog, {
      title: "Rich task",
      description: "Complex",
      items: [{ text: "Step 1", done: false }],
      acceptance: ["Passes tests"],
      dependencies: ["t0"],
    });

    expect(task.items.length).toBe(1);
    expect(task.acceptance).toEqual(["Passes tests"]);
    expect(task.dependencies).toEqual(["t0"]);
  });

  test("updateTask modifies an existing task", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "Update me", description: "Original" });

    updateTask(backlog, "t1", { description: "Updated", status: "active" });

    expect(backlog.tasks[0].description).toBe("Updated");
    expect(backlog.tasks[0].status).toBe("active");
  });

  test("updateTask does nothing for nonexistent id", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "Exists", description: "" });

    updateTask(backlog, "t99", { description: "Ghost" });

    expect(backlog.tasks[0].description).toBe("");
  });

  test("deleteTask removes task by id", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "Keep", description: "" });
    addTask(backlog, { title: "Remove", description: "" });

    deleteTask(backlog, "t2");

    expect(backlog.tasks.length).toBe(1);
    expect(backlog.tasks[0].title).toBe("Keep");
  });

  test("moveTaskUp swaps task with previous", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "A", description: "" });
    addTask(backlog, { title: "B", description: "" });
    addTask(backlog, { title: "C", description: "" });

    moveTaskUp(backlog, 2);

    expect(backlog.tasks[1].title).toBe("C");
    expect(backlog.tasks[2].title).toBe("B");
  });

  test("moveTaskUp at index 0 does nothing", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "A", description: "" });
    addTask(backlog, { title: "B", description: "" });

    moveTaskUp(backlog, 0);

    expect(backlog.tasks[0].title).toBe("A");
  });

  test("moveTaskDown swaps task with next", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "A", description: "" });
    addTask(backlog, { title: "B", description: "" });

    moveTaskDown(backlog, 0);

    expect(backlog.tasks[0].title).toBe("B");
    expect(backlog.tasks[1].title).toBe("A");
  });

  test("moveTaskDown at last index does nothing", () => {
    const backlog = loadBacklog();
    addTask(backlog, { title: "A", description: "" });

    moveTaskDown(backlog, 0);

    expect(backlog.tasks[0].title).toBe("A");
  });
});

describe("dependencies", () => {
  let tp: TestPorts;
  let prev: Ports;
  let backlog: Backlog;

  beforeEach(() => {
    tp = createTestPorts({ root: "/repo/proj" });
    prev = setPorts(tp);
    backlog = { project: "proj", tasks: [] };
  });

  afterEach(() => {
    setPorts(prev);
  });

  function makeTask(id: string, status: Task["status"], deps: string[] = []): Task {
    return {
      id,
      title: id,
      description: "",
      status,
      items: [],
      acceptance: [],
      dependencies: deps,
      design: null,
      branch: null,
      pr: null,
      createdAt: "2024-01-01T00:00:00Z",
      startedAt: null,
      shippedAt: null,
    };
  }

  test("dependenciesMet returns true when no dependencies", () => {
    const task = makeTask("t1", "pending");
    backlog.tasks = [task];
    expect(dependenciesMet(backlog, task)).toBe(true);
  });

  test("dependenciesMet returns true when deps are shipped", () => {
    const dep = makeTask("t1", "shipped");
    const task = makeTask("t2", "pending", ["t1"]);
    backlog.tasks = [dep, task];
    expect(dependenciesMet(backlog, task)).toBe(true);
  });

  test("dependenciesMet returns true when deps are merged", () => {
    const dep = makeTask("t1", "merged");
    const task = makeTask("t2", "pending", ["t1"]);
    backlog.tasks = [dep, task];
    expect(dependenciesMet(backlog, task)).toBe(true);
  });

  test("dependenciesMet returns false when dep is pending", () => {
    const dep = makeTask("t1", "pending");
    const task = makeTask("t2", "pending", ["t1"]);
    backlog.tasks = [dep, task];
    expect(dependenciesMet(backlog, task)).toBe(false);
  });

  test("dependenciesMet returns false when dep is active", () => {
    const dep = makeTask("t1", "active");
    const task = makeTask("t2", "pending", ["t1"]);
    backlog.tasks = [dep, task];
    expect(dependenciesMet(backlog, task)).toBe(false);
  });

  test("dependenciesMet returns false when dep doesn't exist", () => {
    const task = makeTask("t2", "pending", ["t99"]);
    backlog.tasks = [task];
    expect(dependenciesMet(backlog, task)).toBe(false);
  });

  test("nextPendingTask returns first pending task with deps met", () => {
    const t1 = makeTask("t1", "active");
    const t2 = makeTask("t2", "pending", ["t1"]);
    const t3 = makeTask("t3", "pending");
    backlog.tasks = [t1, t2, t3];

    const next = nextPendingTask(backlog);
    expect(next?.id).toBe("t3");
  });

  test("nextPendingTask returns null when all blocked", () => {
    const t1 = makeTask("t1", "active");
    const t2 = makeTask("t2", "pending", ["t1"]);
    backlog.tasks = [t1, t2];

    expect(nextPendingTask(backlog)).toBeNull();
  });

  test("nextPendingTask returns null when no pending tasks", () => {
    const t1 = makeTask("t1", "shipped");
    backlog.tasks = [t1];

    expect(nextPendingTask(backlog)).toBeNull();
  });
});
