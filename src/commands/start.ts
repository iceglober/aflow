import { command, positional, flag, optional, string, option } from "cmd-ts";
import { createTask, findTaskByWorktree, findTaskByBranch, loadTask } from "../lib/state.js";
import { runPipeline } from "../lib/pipeline.js";
import { gitRoot, git, gitSafe } from "../lib/git.js";
import { bold, info, warn } from "../lib/fmt.js";
import { slugify } from "../lib/slug.js";
import { ensureWorktree } from "../lib/worktree.js";
import * as readline from "node:readline";

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export const start = command({
  name: "start",
  description: "Start or resume a task pipeline",
  args: {
    description: positional({
      type: optional(string),
      displayName: "description",
      description: "What are you working on?",
    }),
    quick: flag({ long: "quick", short: "q", description: "Skip design phases (bugs/small features)" }),
  },
  handler: async (args) => {
    // 1. Check if we're in a worktree with an active task (R-11)
    const cwd = process.cwd();
    let task = findTaskByWorktree(cwd);

    // Also try matching by current branch
    if (!task) {
      const branch = gitSafe("branch", "--show-current");
      if (branch) {
        task = findTaskByBranch(branch);
      }
    }

    if (task) {
      // Resume existing task
      if (task.phase === "done" || task.phase === "cancelled") {
        info(`task ${bold(task.id)} is already ${task.phase}.`);
        return;
      }
      info(`resuming ${bold(task.id)}: ${task.title} [${task.phase}]`);
      await runPipeline(task);
      return;
    }

    // 2. No active task — need a description
    let desc = args.description;
    if (!desc) {
      desc = await ask("What are you working on? ");
      if (!desc) {
        warn("No description provided. Exiting.");
        process.exit(0);
      }
    }

    // 3. Create the task
    const phase = args.quick ? "implement" : "understand";
    task = createTask({
      title: desc,
      phase,
      actor: "af start",
    });

    info(`created ${bold(task.id)}: ${task.title}`);

    // 4. For --quick, create worktree immediately (BR-07)
    if (args.quick) {
      const slug = slugify(`${task.id}-${task.title}`);
      const wtPath = ensureWorktree(slug);
      task.branch = slug;
      task.worktree = wtPath;
      const { saveTask } = await import("../lib/state.js");
      saveTask(task);
    }

    // 5. Run the pipeline
    await runPipeline(task);
  },
});
