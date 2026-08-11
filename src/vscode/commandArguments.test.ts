import { describe, expect, it } from 'vitest';
import type { ReviewIssue, ReviewRunResult } from '../core/types';
import { buildReviewTree } from '../app/treeModel';
import { issueFromCommandArgument, suggestionFromCommandArgument } from './commandArguments';

const issue: ReviewIssue = {
  id: 'issue-1', title: 'Unsafe input', severity: 'high', category: 'security',
  message: 'Input is trusted.', suggestion: 'Validate input.', file: 'src/a.ts', startLine: 4, endLine: 5,
};

function actualIssueNode(): unknown {
  const result: ReviewRunResult = {
    summary: 'One issue.', issues: [issue],
    metadata: { mode: 'file', reviewedAt: '2026-08-11T00:00:00.000Z', issueCount: 1 },
  };
  return buildReviewTree({ status: 'success', result, lastTarget: 'file' })[1].children?.[0];
}

describe('VS Code command arguments', () => {
  it('extracts the nested suggestion from the actual Tree View context-menu argument', () => {
    expect(suggestionFromCommandArgument(actualIssueNode())).toBe('Validate input.');
  });

  it('accepts the direct issue argument used by the issue click command', () => {
    expect(issueFromCommandArgument(issue)).toEqual(issue);
  });

  it('rejects invalid or incomplete context-menu values without throwing', () => {
    expect(issueFromCommandArgument({ id: 'issue-node', issue: { suggestion: 'partial' } })).toBeUndefined();
    expect(suggestionFromCommandArgument({ id: 'message-node' })).toBeUndefined();
    expect(suggestionFromCommandArgument(undefined)).toBeUndefined();
  });
});
