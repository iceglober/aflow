export type { GitPort, WorktreeEntry } from "./git.js";
export type { FsPort } from "./fs.js";
export type { ShellPort } from "./shell.js";
export type { ConsolePort } from "./console.js";

/** All ports bundled together for dependency injection. */
export interface Ports {
  git: import("./git.js").GitPort;
  fs: import("./fs.js").FsPort;
  shell: import("./shell.js").ShellPort;
  console: import("./console.js").ConsolePort;
}
