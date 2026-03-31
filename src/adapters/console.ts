import type { ConsolePort } from "../ports/console.js";

/** Real console adapter — delegates to console.log/error. */
export class RealConsoleAdapter implements ConsolePort {
  log(message: string): void {
    console.log(message);
  }

  error(message: string): void {
    console.error(message);
  }
}
