import * as path from 'node:path';

export function resolveIssueFile(
  issueFile: string,
  workspaceRoot?: string,
  activeFile?: string,
): string | undefined {
  const normalized = issueFile.trim();
  if (!normalized) {
    return activeFile;
  }
  if (path.isAbsolute(normalized)) {
    return path.normalize(normalized);
  }
  return workspaceRoot ? path.resolve(workspaceRoot, normalized) : activeFile;
}

export function issueLineRange(issue: { startLine: number; endLine: number }): {
  startLine: number;
  endLine: number;
} {
  const startLine = Math.max(0, Math.trunc(issue.startLine) - 1);
  const endLine = Math.max(startLine, Math.trunc(issue.endLine) - 1);
  return { startLine, endLine };
}
