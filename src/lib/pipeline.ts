import {
  loadTask,
  loadPipeline,
  savePipeline,
  transitionTask,
  type Task,
  type Phase,
  type PipelineState,
} from "./state.js";
import { runSession } from "./session-runner.js";
import { gitRoot } from "./git.js";
import { ensureWorktree } from "./worktree.js";
import { slugify } from "./slug.js";
import { ok, info, warn, bold, dim } from "./fmt.js";
import * as readline from "node:readline";

// ── Skill definitions per phase ──────────────────────────────────────

const DESIGN_SKILLS = ["spec-make", "spec-enrich", "spec-refine", "spec-lab", "spec-review"];

interface PhaseSkills {
  skills: string[];
  interactive: boolean;
}

function phaseSkills(phase: Phase): PhaseSkills {
  switch (phase) {
    case "understand":
      return { skills: ["think"], interactive: true };
    case "design":
      return { skills: DESIGN_SKILLS, interactive: true };
    case "implement":
      return { skills: ["work"], interactive: false };
    case "verify":
      return { skills: ["qa"], interactive: false };
    case "ship":
      return { skills: ["ship"], interactive: false };
    default:
      return { skills: [], interactive: false };
  }
}

// ── User prompts ─────────────────────────────────────────────────────

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} [y/n] `);
  return answer.toLowerCase().startsWith("y");
}

// ── Build the prompt for a skill session ─────────────────────────────

function buildSkillPrompt(skill: string, task: Task): string {
  const ctx = [
    `Task ${task.id}: ${task.title}`,
    task.description ? `Description: ${task.description}` : "",
    task.spec ? `Spec: ${task.spec}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Map skill name to slash command
  const cmd = `/${skill.replace("-", "-")}`;

  return `${ctx}\n\n${cmd} ${task.id}: ${task.title}`;
}

// ── Determine the working directory for a phase ──────────────────────

function sessionCwd(task: Task, phase: Phase): string {
  if (task.worktree && (phase === "implement" || phase === "verify" || phase === "ship")) {
    return task.worktree;
  }
  return gitRoot();
}

// ── Pipeline orchestrator ────────────────────────────────────────────

export async function runPipeline(task: Task): Promise<void> {
  info(`pipeline: ${bold(task.id)} — ${task.title}`);

  while (true) {
    // Reload task to get latest state
    const current = loadTask(task.id);
    if (!current) {
      warn(`task ${task.id} not found, aborting pipeline.`);
      return;
    }

    // Terminal?
    if (current.phase === "done" || current.phase === "cancelled") {
      ok(`${bold(current.id)} is ${current.phase}. Pipeline complete.`);
      return;
    }

    // If epic with children, run children sequentially
    if (current.children.length > 0) {
      await runEpicChildren(current);
      return;
    }

    const { skills, interactive } = phaseSkills(current.phase);
    if (skills.length === 0) {
      ok(`no skills for phase "${current.phase}", advancing...`);
      advancePhase(current);
      continue;
    }

    // Load or create pipeline state
    let pipeline = loadPipeline(current.id);
    if (!pipeline || pipeline.currentPhase !== current.phase) {
      pipeline = {
        taskId: current.id,
        currentPhase: current.phase,
        completedSkills: [],
        skippedSkills: [],
        nextSkill: skills[0],
        startedAt: new Date().toISOString(),
      };
      savePipeline(pipeline);
    }

    // Ensure worktree exists before implement phase
    if (current.phase === "implement" && !current.worktree) {
      const slug = slugify(`${current.id}-${current.title}`);
      const wtPath = ensureWorktree(slug);
      const { saveTask } = await import("./state.js");
      const t = loadTask(current.id)!;
      t.branch = slug;
      t.worktree = wtPath;
      saveTask(t);
    }

    // Run remaining skills
    for (const skill of skills) {
      if (pipeline.completedSkills.includes(skill) || pipeline.skippedSkills.includes(skill)) {
        continue;
      }

      info(`running /${bold(skill)} for ${current.id}...`);

      const cwd = sessionCwd(current, current.phase);
      const prompt = buildSkillPrompt(skill, current);
      const exitCode = runSession({ cwd, prompt, interactive });

      if (exitCode !== 0) {
        warn(`/${skill} exited with code ${exitCode}. Session may have crashed.`);
        warn(`run ${bold("af start")} to resume from this point.`);
        return;
      }

      // Mark completed
      pipeline.completedSkills.push(skill);
      const nextIdx = skills.indexOf(skill) + 1;
      pipeline.nextSkill = nextIdx < skills.length ? skills[nextIdx] : null;
      savePipeline(pipeline);

      // Special: spec-refine can run multiple rounds (BR-11)
      if (skill === "spec-refine" && current.phase === "design") {
        // After spec-refine, check if user wants another round
        // (the skill itself handles the conversation; we just offer to re-run)
        const again = await confirm("Run another refinement round?");
        if (again) {
          // Remove spec-refine from completed so it runs again
          pipeline.completedSkills = pipeline.completedSkills.filter((s) => s !== "spec-refine");
          pipeline.nextSkill = "spec-refine";
          savePipeline(pipeline);
        }
      }
    }

    // User gate for understand and design phases
    if (current.phase === "understand" || current.phase === "design") {
      const approved = await confirm(`${bold(current.phase)} phase complete. Approve and continue?`);
      if (!approved) {
        warn("Pipeline paused. Run af start to resume.");
        return;
      }
    }

    // BR-09: QA failure rework loop
    if (current.phase === "verify") {
      const updated = loadTask(current.id);
      if (updated?.qaResult?.status === "fail") {
        warn(`QA failed: ${updated.qaResult.summary}`);
        const retry = await confirm("Retry implementation?");
        if (retry) {
          transitionTask(current.id, "implement", { force: true, actor: "orchestrator/qa-rework" });
          ok(`${bold(current.id)} → implement (rework)`);
          // Reset pipeline state for implement phase
          savePipeline({
            taskId: current.id,
            currentPhase: "implement",
            completedSkills: [],
            skippedSkills: [],
            nextSkill: "work",
            startedAt: new Date().toISOString(),
          });
          continue; // re-enter the loop at implement phase
        }
        warn("Leaving task in verify for manual intervention.");
        return;
      }
    }

    // Advance to next phase
    advancePhase(current);
  }
}

function advancePhase(task: Task): void {
  const order: Phase[] = ["understand", "design", "implement", "verify", "ship", "done"];
  const idx = order.indexOf(task.phase);
  if (idx < 0 || idx >= order.length - 1) return;

  const next = order[idx + 1];
  try {
    transitionTask(task.id, next, { actor: "orchestrator" });
    ok(`${bold(task.id)} → ${next}`);
  } catch (e: any) {
    warn(e.message);
  }
}

async function runEpicChildren(epic: Task): Promise<void> {
  info(`epic ${bold(epic.id)} has ${epic.children.length} workstreams`);

  for (const childId of epic.children) {
    const child = loadTask(childId);
    if (!child) {
      warn(`workstream ${childId} not found, skipping.`);
      continue;
    }
    if (child.phase === "done" || child.phase === "cancelled") {
      info(`${childId} already ${child.phase}, skipping.`);
      continue;
    }

    // Check dependencies (BR-02)
    const { dependenciesMet } = await import("./state.js");
    if (!dependenciesMet(child)) {
      warn(`${childId} blocked by dependencies, skipping.`);
      continue;
    }

    info(`starting workstream ${bold(childId)}: ${child.title}`);
    await runPipeline(child);
  }

  ok(`epic ${bold(epic.id)} pipeline complete.`);
}
