import { ports } from "../container.js";

/** Pull main with fast-forward only. Returns true on success. */
export function pullMain(): boolean {
  try {
    ports().git.run("pull", "--ff-only", "origin", "main");
    return true;
  } catch {
    return false;
  }
}

/** Check PR status via gh CLI. Returns "open", "merged", or "closed". */
export function checkPrStatus(prUrl: string): "open" | "merged" | "closed" | "unknown" {
  try {
    const result = ports().shell.execFile("gh", ["pr", "view", prUrl, "--json", "state", "-q", ".state"], {
      timeout: 10_000,
    });
    if (result === "MERGED") return "merged";
    if (result === "CLOSED") return "closed";
    if (result === "OPEN") return "open";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/** Start polling a PR for merge. Calls onMerged when it merges. Returns cleanup fn. */
export function startMergeWatcher(
  prUrl: string,
  onMerged: () => void,
  intervalMs = 30_000,
): () => void {
  const timer = setInterval(() => {
    const status = checkPrStatus(prUrl);
    if (status === "merged") {
      clearInterval(timer);
      onMerged();
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
