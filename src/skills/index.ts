/**
 * Embedded skill files for the aflow workflow.
 * These get written to .claude/commands/ (commands) and .claude/skills/ (skills)
 * by `af skills`.
 *
 * Commands are slash-invokable workflows (/work, /ship, /spec-make, etc.)
 * Skills are capabilities that activate automatically when relevant (/browser, etc.)
 */

import { think } from "./think.js";
import { work } from "./work.js";
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
import { browser } from "./browser.js";
import { productDiscoveryNew } from "./product-discovery-new.js";
import { productDiscoveryRefine } from "./product-discovery-refine.js";
import { productDiscoveryUser } from "./product-discovery-user.js";
import { productPrdNew } from "./product-prd-new.js";
import { productPrdRefine } from "./product-prd-refine.js";
import { productPipeline } from "./product-pipeline.js";

/** Slash commands — invoked explicitly via /name */
export const COMMANDS: Record<string, string> = {
  // Engineering
  "think.md": think(),
  "work.md": work(),
  "fix.md": fix(),
  "qa.md": qa(),
  "ship.md": ship(),
  "research-auto.md": researchAuto(),

  // Design pipeline
  "research-web.md": researchWeb(),
  "spec-make.md": specMake(),
  "spec-refine.md": specRefine(),
  "spec-enrich.md": specEnrich(),
  "spec-review.md": specReview(),
  "spec-lab.md": specLab(),

  // Product documentation pipeline
  "product-discovery-new.md": productDiscoveryNew(),
  "product-discovery-refine.md": productDiscoveryRefine(),
  "product-discovery-user.md": productDiscoveryUser(),
  "product-prd-new.md": productPrdNew(),
  "product-prd-refine.md": productPrdRefine(),
  "product-pipeline.md": productPipeline(),
};

/** Skills — activate automatically when relevant */
export const SKILLS: Record<string, string> = {
  "browser.md": browser(),
};
