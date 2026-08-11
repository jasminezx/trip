import { describe, expect, it } from 'vitest';
import {
  collectFileRequest,
  collectGitDiffRequest,
  collectSelectionRequest,
} from './reviewContext';

describe('editor review context', () => {
  it('rejects a missing editor instead of constructing an unusable selection request', () => {
    expect(() => collectSelectionRequest(undefined)).toThrow('Open a file and select code to review.');
  });

  it('rejects an empty selection', () => {
    expect(() => collectSelectionRequest({
      documentText: 'const answer = 42;',
      selectionText: '',
      filePath: 'src/answer.ts',
      language: 'typescript',
    })).toThrow('Select some code to review.');
  });

  it('builds a selection request from the selected text and document metadata', () => {
    expect(collectSelectionRequest({
      documentText: 'const answer = 42;',
      selectionText: 'answer = 42',
      filePath: 'C:\\repo\\src\\answer.ts',
      workspaceRoots: ['C:\\repo'],
      selectionStartLine: 17,
      language: 'typescript',
    })).toEqual({
      mode: 'selection',
      content: 'answer = 42',
      filePath: 'src/answer.ts',
      navigationFilePath: 'C:\\repo\\src\\answer.ts',
      selectionStartLine: 17,
      language: 'typescript',
    });
  });

  it('uses only a basename in the prompt when an editor file is outside the workspace', () => {
    expect(collectSelectionRequest({
      documentText: 'const answer = 42;',
      selectionText: 'answer = 42',
      filePath: 'D:\\scratch\\answer.ts',
      workspaceRoots: ['C:\\repo'],
      selectionStartLine: 1,
      language: 'typescript',
    })).toMatchObject({
      filePath: 'answer.ts',
      navigationFilePath: 'D:\\scratch\\answer.ts',
    });
  });

  it('rejects an empty current file', () => {
    expect(() => collectFileRequest({
      documentText: ' \n',
      selectionText: '',
      filePath: 'empty.ts',
      language: 'typescript',
    })).toThrow('The current file is empty.');
  });
});

describe('Git diff context', () => {
  it('rejects diff review when no workspace is open without running Git', async () => {
    let calls = 0;
    await expect(collectGitDiffRequest(undefined, async () => {
      calls += 1;
      return { exitCode: 0, stdout: '', stderr: '' };
    })).rejects.toThrow('Open a workspace to review its Git diff.');
    expect(calls).toBe(0);
  });

  it('combines unstaged and staged changes from the first workspace root', async () => {
    const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
    const request = await collectGitDiffRequest('C:/repo', async (command, args, cwd) => {
      calls.push({ command, args, cwd });
      return calls.length === 1
        ? { exitCode: 0, stdout: 'diff --git a/a.ts b/a.ts\n', stderr: '' }
        : { exitCode: 0, stdout: 'diff --git a/b.ts b/b.ts\n', stderr: '' };
    });

    expect(request).toEqual({
      mode: 'diff',
      content: '### Unstaged changes\ndiff --git a/a.ts b/a.ts\n\n### Staged changes\ndiff --git a/b.ts b/b.ts',
    });
    expect(calls).toEqual([
      { command: 'git', args: ['diff', '--no-ext-diff'], cwd: 'C:/repo' },
      { command: 'git', args: ['diff', '--cached', '--no-ext-diff'], cwd: 'C:/repo' },
    ]);
  });

  it('reports useful Git stderr and does not hide which diff failed', async () => {
    await expect(collectGitDiffRequest('C:/repo', async () => ({
      exitCode: 128,
      stdout: '',
      stderr: 'fatal: not a git repository',
    }))).rejects.toThrow('Unable to collect unstaged Git diff: fatal: not a git repository');
  });

  it('rejects a repository with no staged or unstaged changes', async () => {
    await expect(collectGitDiffRequest('C:/repo', async () => ({
      exitCode: 0,
      stdout: ' \n',
      stderr: '',
    }))).rejects.toThrow('There are no staged or unstaged changes to review.');
  });

  it('preserves whitespace that is part of a changed line', async () => {
    let call = 0;
    const request = await collectGitDiffRequest('C:/repo', async () => {
      call += 1;
      return call === 1
        ? { exitCode: 0, stdout: 'diff --git a/a b/a\n+  \n', stderr: '' }
        : { exitCode: 0, stdout: '', stderr: '' };
    });
    expect(request.content).toBe('### Unstaged changes\ndiff --git a/a b/a\n+  ');
  });
});
