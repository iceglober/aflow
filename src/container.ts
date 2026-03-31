import type { Ports } from "./ports/index.js";
import { RealGitAdapter } from "./adapters/git.js";
import { RealFsAdapter } from "./adapters/fs.js";
import { RealShellAdapter } from "./adapters/shell.js";
import { RealConsoleAdapter } from "./adapters/console.js";

/** Default ports wired to real implementations. */
let _ports: Ports = {
  git: new RealGitAdapter(),
  fs: new RealFsAdapter(),
  shell: new RealShellAdapter(),
  console: new RealConsoleAdapter(),
};

/** Get the current ports instance. */
export function ports(): Ports {
  return _ports;
}

/** Replace ports (for testing). Returns the previous ports for restoration. */
export function setPorts(p: Ports): Ports {
  const prev = _ports;
  _ports = p;
  return prev;
}
