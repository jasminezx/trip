import { describe, expect, expectTypeOf, it } from 'vitest';

import { createIssueId } from './issueId';
import { normalizeReviewIssue } from './reviewIssue';
import {
  clampRange,
  isValidRange,
  normalizeLineEndings,
  textInRange,
  truncateText,
} from './text';

type ExpectedReviewIssue = {
  id: string;
  title: string;
  severity: 'high' | 'medium' | 'low';
  category: 'bug' | 'performance' | 'security' | 'maintainability' | 'best_practice';
  message: string;
  suggestion: string;
  file: string;
  startLine: number;
  endLine: number;
  navigationFilePath?: string;
};

describe('normalizeReviewIssue', () => {
  it('returns the exact normalized issue contract used by the review pipeline', () => {
    const issue = normalizeReviewIssue({
      title: ' Unsafe shell command ',
      severity: 'high',
      category: 'security',
      message: ' User input reaches exec. ',
      suggestion: ' Validate the command. ',
      file: ' src/run.ts ',
      startLine: 8,
      endLine: 6,
    });

    expectTypeOf(issue).toEqualTypeOf<ExpectedReviewIssue>();
    expect(issue).toEqual({
      id: expect.stringMatching(/^issue_[0-9a-f]{8}$/),
      title: 'Unsafe shell command',
      severity: 'high',
      category: 'security',
      message: 'User input reaches exec.',
      suggestion: 'Validate the command.',
      file: 'src/run.ts',
      startLine: 8,
      endLine: 8,
    });
  });
});

describe('createIssueId', () => {
  it('creates a stable identifier from issue identity fields', () => {
    const id = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 2, startCharacter: 4, endLine: 2, endCharacter: 9 },
      message: 'Avoid mutable shared state',
      title: 'No mutation',
      suggestion: 'Use const',
    });

    expect(id).toMatch(/^issue_[0-9a-f]{8}$/);
    expect(createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 2, startCharacter: 4, endLine: 2, endCharacter: 9 },
      message: 'Avoid mutable shared state',
      title: 'No mutation',
      suggestion: 'Use const',
    })).toBe(id);
  });

  it('distinguishes issues with a different range', () => {
    const first = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 },
      message: 'Use const',
      title: 'Mutability',
      suggestion: 'Extract helper',
    });
    const second = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 1, startCharacter: 0, endLine: 1, endCharacter: 2 },
      message: 'Use const',
      title: 'Mutability',
      suggestion: 'Extract helper',
    });

    expect(first).not.toBe(second);
  });

  it('distinguishes findings with same location and message but different title or suggestion', () => {
    const first = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 2, startCharacter: 0, endLine: 2, endCharacter: 3 },
      message: 'Shared message',
      title: 'One',
      suggestion: 'Fix it',
    });
    const second = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 2, startCharacter: 0, endLine: 2, endCharacter: 3 },
      message: 'Shared message',
      title: 'One',
      suggestion: 'Different suggestion',
    });
    const third = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 2, startCharacter: 0, endLine: 2, endCharacter: 3 },
      message: 'Shared message',
      title: 'Different title',
      suggestion: 'Fix it',
    });

    expect(new Set([first, second, third]).size).toBe(3);
  });
});

describe('text utilities', () => {
  it('normalizes CRLF and CR line endings to LF', () => {
    expect(normalizeLineEndings('one\r\ntwo\rthree\nfour')).toBe('one\ntwo\nthree\nfour');
  });

  it('truncates long text at the requested length with an ellipsis', () => {
    expect(truncateText('abcdefgh', 5)).toBe('abcd…');
  });

  it('does not append an ellipsis when text fits the limit', () => {
    expect(truncateText('short', 5)).toBe('short');
  });
});

describe('range utilities', () => {
  it('rejects ranges that end before their start', () => {
    expect(isValidRange({ startLine: 3, startCharacter: 0, endLine: 2, endCharacter: 12 })).toBe(false);
  });

  it('clamps ranges to a document boundary without reversing the range', () => {
    expect(clampRange(
      { startLine: -2, startCharacter: -4, endLine: 8, endCharacter: 5 },
      { lineCount: 3, lastLineLength: 2 },
    )).toEqual({ startLine: 0, startCharacter: 0, endLine: 2, endCharacter: 2 });
  });

  it('extracts text across a half-open multi-line range', () => {
    expect(textInRange(
      'alpha\nbeta\ngamma',
      { startLine: 0, startCharacter: 2, endLine: 2, endCharacter: 3 },
    )).toBe('pha\nbeta\ngam');
  });
});
