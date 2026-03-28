import { command, flag } from "cmd-ts";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { SKILLS } from "../skills/index.js";
import { ok, info, warn } from "../lib/fmt.js";
import { gitRoot } from "../lib/git.js";

export const installSkills = command({
  name: "skills",
  description:
    "Install aflow workflow skills as Claude Code slash commands",
  args: {
    force: flag({
      long: "force",
      description: "Overwrite existing skill files",
    }),
    user: flag({
      long: "user",
      description: "Install to ~/.claude/commands/ (user-level) instead of the current project",
    }),
  },
  handler: async ({ force, user }) => {
    let baseDir: string;

    if (user) {
      baseDir = path.join(os.homedir(), ".claude", "commands");
    } else {
      let root: string;
      try {
        root = gitRoot();
      } catch {
        console.error("Not in a git repository (use --user to install globally)");
        process.exit(1);
      }
      baseDir = path.join(root, ".claude", "commands");
    }

    const names = Object.keys(SKILLS);
    let installed = 0;
    let skipped = 0;

    for (const name of names) {
      const dest = path.join(baseDir, name);
      // Create subdirectories as needed (e.g., prod/)
      fs.mkdirSync(path.dirname(dest), { recursive: true });

      if (fs.existsSync(dest) && !force) {
        skipped++;
        continue;
      }
      fs.writeFileSync(dest, SKILLS[name]);
      installed++;
    }

    const target = user ? "~/.claude/commands/" : ".claude/commands/";

    if (installed > 0) {
      ok(`installed ${installed} skills to ${target}`);
    }
    if (skipped > 0) {
      info(`skipped ${skipped} existing files (use --force to overwrite)`);
    }

    // List what's available
    console.log("");
    info("available skills:");
    for (const name of names) {
      const slug = name.replace(".md", "").replace(/\//g, ":");
      console.log(`  /${slug}`);
    }

    if (!user) {
      // Check for .aflow/backlog.json
      const root = gitRoot();
      const backlogJson = path.join(root, ".aflow", "backlog.json");
      if (!fs.existsSync(backlogJson)) {
        console.log("");
        info("run `af start` to create a backlog — skills read tasks from .aflow/backlog.json");
      }
    }
  },
});
