import { describe, expect, it } from 'vitest';

import { createIssueId } from './issueId';
import {
  clampRange,
  isValidRange,
  normalizeLineEndings,
  textInRange,
  truncateText,
} from './text';

describe('createIssueId', () => {
  it('creates a stable identifier from the issue location and message', () => {
    expect(createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 2, startCharacter: 4, endLine: 2, endCharacter: 9 },
      message: 'Avoid mutable shared state',
    })).toBe('issue_6e7c7e3e');
  });

  it('distinguishes issues with a different range', () => {
    const first = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 0, startCharacter: 0, endLine: 0, endCharacter: 2 },
      message: 'Use const',
    });
    const second = createIssueId({
      filePath: 'src/example.ts',
      range: { startLine: 1, startCharacter: 0, endLine: 1, endCharacter: 2 },
      message: 'Use const',
    });

    expect(first).not.toBe(second);
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
