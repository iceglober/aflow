import nodeFs from "node:fs";
import type { FsPort } from "../ports/fs.js";

/** Real filesystem adapter — delegates to Node.js fs. */
export class RealFsAdapter implements FsPort {
  existsSync(path: string): boolean {
    return nodeFs.existsSync(path);
  }

  readFileSync(path: string, encoding: BufferEncoding): string {
    return nodeFs.readFileSync(path, encoding);
  }

  writeFileSync(path: string, data: string | Buffer, options?: { mode?: number }): void {
    nodeFs.writeFileSync(path, data, options);
  }

  mkdirSync(path: string, options?: { recursive?: boolean }): void {
    nodeFs.mkdirSync(path, options);
  }

  statSync(path: string): { mode: number } {
    return nodeFs.statSync(path);
  }

  realpathSync(path: string): string {
    return nodeFs.realpathSync(path);
  }

  accessSync(path: string, mode?: number): void {
    nodeFs.accessSync(path, mode);
  }

  renameSync(oldPath: string, newPath: string): void {
    nodeFs.renameSync(oldPath, newPath);
  }

  chmodSync(path: string, mode: number): void {
    nodeFs.chmodSync(path, mode);
  }
}
