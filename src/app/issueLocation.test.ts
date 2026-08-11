import { describe, expect, it } from 'vitest';
import { issueLineRange, resolveIssueFile } from './issueLocation';

describe('issue location', () => {
  it('resolves a relative model path against the first workspace root', () => {
    expect(resolveIssueFile('src/a.ts', 'C:\\repo', 'C:\\repo\\open.ts')).toBe('C:\\repo\\src\\a.ts');
  });

  it('falls back to the active file for a blank issue path', () => {
    expect(resolveIssueFile('', 'C:\\repo', 'C:\\repo\\open.ts')).toBe('C:\\repo\\open.ts');
  });

  it('returns one-based issue lines as a zero-based inclusive editor range', () => {
    expect(issueLineRange({ startLine: 4, endLine: 6 })).toEqual({ startLine: 3, endLine: 5 });
    expect(issueLineRange({ startLine: 0, endLine: -2 })).toEqual({ startLine: 0, endLine: 0 });
  });
});
