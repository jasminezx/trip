import * as path from 'node:path';
import type { ReviewRequest } from '../core/types';

export interface EditorContext {
  documentText: string;
  selectionText: string;
  filePath?: string;
  workspaceRoots?: readonly string[];
  language?: string;
  selectionStartLine?: number;
}

export interface ProcessResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type ProcessRunner = (command: string, args: string[], cwd: string) => Promise<ProcessResult>;

export class ReviewContextError extends Error {
  public readonly name = 'ReviewContextError';
}

function pathOperations(values: readonly string[]): typeof path.win32 | typeof path.posix {
  return values.some((value) => /^[a-z]:[\\/]/i.test(value) || /^\\\\/.test(value))
    ? path.win32
    : path.posix;
}

function editorPathMetadata(context: EditorContext): Pick<ReviewRequest, 'filePath' | 'navigationFilePath'> {
  const filePath = context.filePath?.trim();
  if (!filePath) {
    return {};
  }
  const roots = context.workspaceRoots ?? [];
  const operations = pathOperations([filePath, ...roots]);
  if (!operations.isAbsolute(filePath)) {
    return { filePath: filePath.replace(/\\/g, '/') };
  }

  const navigationFilePath = operations.resolve(filePath);
  for (const root of roots) {
    const relative = operations.relative(operations.resolve(root), navigationFilePath);
    const inside = relative === ''
      || (relative !== '..' && !relative.startsWith(`..${operations.sep}`) && !operations.isAbsolute(relative));
    if (inside) {
      return { filePath: relative.replace(/\\/g, '/'), navigationFilePath };
    }
  }
  return { filePath: operations.basename(navigationFilePath), navigationFilePath };
}

export function collectSelectionRequest(context: EditorContext | undefined): ReviewRequest {
  if (!context) {
    throw new ReviewContextError('Open a file and select code to review.');
  }
  if (!context.selectionText.trim()) {
    throw new ReviewContextError('Select some code to review.');
  }
  return {
    mode: 'selection',
    content: context.selectionText,
    ...editorPathMetadata(context),
    language: context.language,
    selectionStartLine: Math.max(1, Math.trunc(context.selectionStartLine ?? 1)),
  };
}

export function collectFileRequest(context: EditorContext | undefined): ReviewRequest {
  if (!context) {
    throw new ReviewContextError('Open a file to review.');
  }
  if (!context.documentText.trim()) {
    throw new ReviewContextError('The current file is empty.');
  }
  return {
    mode: 'file',
    content: context.documentText,
    ...editorPathMetadata(context),
    language: context.language,
  };
}

function gitFailure(kind: 'unstaged' | 'staged', result: ProcessResult): Error {
  const detail = result.stderr.trim() || `Git exited with code ${result.exitCode}.`;
  return new ReviewContextError(`Unable to collect ${kind} Git diff: ${detail}`);
}

function withoutTrailingLineEndings(text: string): string {
  return text.replace(/(?:\r?\n)+$/, '');
}

export async function collectGitDiffRequest(
  workspaceRoot: string | undefined,
  runProcess: ProcessRunner,
): Promise<ReviewRequest> {
  if (!workspaceRoot) {
    throw new ReviewContextError('Open a workspace to review its Git diff.');
  }

  const unstaged = await runProcess('git', ['diff', '--no-ext-diff'], workspaceRoot);
  if (unstaged.exitCode !== 0) {
    throw gitFailure('unstaged', unstaged);
  }
  const staged = await runProcess('git', ['diff', '--cached', '--no-ext-diff'], workspaceRoot);
  if (staged.exitCode !== 0) {
    throw gitFailure('staged', staged);
  }

  const sections: string[] = [];
  if (unstaged.stdout.trim()) {
    sections.push(`### Unstaged changes\n${withoutTrailingLineEndings(unstaged.stdout)}`);
  }
  if (staged.stdout.trim()) {
    sections.push(`### Staged changes\n${withoutTrailingLineEndings(staged.stdout)}`);
  }
  if (!sections.length) {
    throw new ReviewContextError('There are no staged or unstaged changes to review.');
  }
  return { mode: 'diff', content: sections.join('\n\n') };
}
