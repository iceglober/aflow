/**
 * Port for console output.
 * Abstracts console.log/error so output can be captured in tests.
 */
export interface ConsolePort {
  log(message: string): void;
  error(message: string): void;
}
