/**
 * Embedded skill files for the aflow workflow.
 * These get written to .claude/commands/ by `af skills`.
 *
 * Each skill is defined in its own file under src/skills/.
 * Skills that operate on a backlog task use the shared TASK_PREAMBLE
 * from preamble.ts to describe how to find the current task.
 */

import { think } from "./think.js";
import { work } from "./work.js";
import { workBacklog } from "./work-backlog.js";
import { fix } from "./fix.js";
import { qa } from "./qa.js";
import { ship } from "./ship.js";
import { researchWeb } from "./research-web.js";
import { specMake } from "./spec-make.js";
import { specRefine } from "./spec-refine.js";
import { specEnrich } from "./spec-enrich.js";
import { specReview } from "./spec-review.js";
import { specLab } from "./spec-lab.js";
import { researchAuto } from "./research-auto.js";

export const SKILLS: Record<string, string> = {
  // Engineering skills
  "think.md": think(),
  "work.md": work(),
  "work-backlog.md": workBacklog(),
  "fix.md": fix(),
  "qa.md": qa(),
  "ship.md": ship(),
  "research-auto.md": researchAuto(),

  // Spec pipeline skills
  "research-web.md": researchWeb(),
  "spec-make.md": specMake(),
  "spec-refine.md": specRefine(),
  "spec-enrich.md": specEnrich(),
  "spec-review.md": specReview(),
  "spec-lab.md": specLab(),
};
