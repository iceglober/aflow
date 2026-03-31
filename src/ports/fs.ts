/**
 * Port for filesystem operations.
 * Abstracts Node.js fs so the domain layer can be tested with in-memory state.
 */
export interface FsPort {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: BufferEncoding): string;
  writeFileSync(path: string, data: string | Buffer, options?: { mode?: number }): void;
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
  statSync(path: string): { mode: number };
  realpathSync(path: string): string;
  accessSync(path: string, mode?: number): void;
  renameSync(oldPath: string, newPath: string): void;
  chmodSync(path: string, mode: number): void;
}
