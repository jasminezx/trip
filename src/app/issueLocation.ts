import * as path from 'node:path';

export interface IssueLocationContext {
  workspaceRoots: readonly string[];
  activeFile?: string;
}

const OUTSIDE_WORKSPACE_MESSAGE = 'This issue points outside the current workspace.';

function pathOperations(values: readonly string[]): typeof path.win32 | typeof path.posix {
  return values.some((value) => /^[a-z]:[\\/]/i.test(value) || /^\\\\/.test(value))
    ? path.win32
    : path.posix;
}

function contains(
  root: string,
  target: string,
  operations: typeof path.win32 | typeof path.posix,
  caseInsensitive: boolean,
): boolean {
  const comparableRoot = caseInsensitive ? root.toLowerCase() : root;
  const comparableTarget = caseInsensitive ? target.toLowerCase() : target;
  const relative = operations.relative(comparableRoot, comparableTarget);
  return relative === ''
    || (relative !== '..' && !relative.startsWith(`..${operations.sep}`) && !operations.isAbsolute(relative));
}

export function resolveIssueFile(
  issueFile: string,
  context: IssueLocationContext,
): string | undefined {
  const normalized = issueFile.trim();
  const values = [normalized, ...context.workspaceRoots, context.activeFile ?? ''];
  const operations = pathOperations(values);
  if (!normalized) {
    return context.activeFile ? operations.resolve(context.activeFile) : undefined;
  }

  const caseInsensitive = operations === path.win32;
  const roots = context.workspaceRoots.map((root) => operations.resolve(root));
  const activeFile = context.activeFile ? operations.resolve(context.activeFile) : undefined;
  const candidate = operations.isAbsolute(normalized)
    ? operations.resolve(normalized)
    : roots[0] ? operations.resolve(roots[0], normalized) : undefined;

  if (!candidate) {
    throw new Error(OUTSIDE_WORKSPACE_MESSAGE);
  }
  const matchesActiveFile = activeFile !== undefined
    && (caseInsensitive ? activeFile.toLowerCase() === candidate.toLowerCase() : activeFile === candidate);
  if (matchesActiveFile || roots.some((root) => contains(root, candidate, operations, caseInsensitive))) {
    return candidate;
  }
  throw new Error(OUTSIDE_WORKSPACE_MESSAGE);
}

export function issueLineRange(issue: { startLine: number; endLine: number }): {
  startLine: number;
  endLine: number;
} {
  const startLine = Math.max(0, Math.trunc(issue.startLine) - 1);
  const endLine = Math.max(startLine, Math.trunc(issue.endLine) - 1);
  return { startLine, endLine };
}
