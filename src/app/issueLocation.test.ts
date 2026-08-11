import { describe, expect, it } from 'vitest';
import { issueLineRange, resolveIssueFile } from './issueLocation';

describe('issue location', () => {
  it('resolves a relative model path against the first workspace root', () => {
    expect(resolveIssueFile('src/a.ts', {
      workspaceRoots: ['C:\\repo'], activeFile: 'C:\\repo\\open.ts',
    })).toBe('C:\\repo\\src\\a.ts');
  });

  it('falls back to the active file for a blank issue path', () => {
    expect(resolveIssueFile('', {
      workspaceRoots: ['C:\\repo'], activeFile: 'C:\\repo\\open.ts',
    })).toBe('C:\\repo\\open.ts');
  });

  it('canonicalizes the active-file fallback before navigation', () => {
    expect(resolveIssueFile('', {
      workspaceRoots: [], activeFile: 'D:\\scratch\\nested\\..\\active.ts',
    })).toBe('D:\\scratch\\active.ts');
  });

  it('allows normalized Windows paths inside any approved root regardless of case or separator style', () => {
    expect(resolveIssueFile('c:/WORK/second/src/../src/a.ts', {
      workspaceRoots: ['C:\\repo', 'C:\\work\\second'], activeFile: 'C:\\repo\\open.ts',
    })?.toLowerCase()).toBe('c:\\work\\second\\src\\a.ts');
  });

  it('allows exactly the active file even when it is outside a workspace', () => {
    expect(resolveIssueFile('d:/scratch/active.ts', {
      workspaceRoots: ['C:\\repo'], activeFile: 'D:\\scratch\\active.ts',
    })?.toLowerCase()).toBe('d:\\scratch\\active.ts');
  });

  it.each([
    ['relative traversal', '..\\secret.ts'],
    ['outside absolute path', 'D:\\secret.ts'],
    ['outside UNC path', '\\\\server\\share\\secret.ts'],
  ])('rejects %s with a user-safe error', (_name, modelPath) => {
    expect(() => resolveIssueFile(modelPath, {
      workspaceRoots: ['C:\\repo'], activeFile: 'C:\\repo\\open.ts',
    })).toThrow('This issue points outside the current workspace.');
  });

  it('returns one-based issue lines as a zero-based inclusive editor range', () => {
    expect(issueLineRange({ startLine: 4, endLine: 6 })).toEqual({ startLine: 3, endLine: 5 });
    expect(issueLineRange({ startLine: 0, endLine: -2 })).toEqual({ startLine: 0, endLine: 0 });
  });
});
