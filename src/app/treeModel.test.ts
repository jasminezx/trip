import { describe, expect, it } from 'vitest';
import type { ReviewRunResult } from '../core/types';
import { buildReviewTree } from './treeModel';

const reviewed: ReviewRunResult = {
  summary: 'Two actionable concerns.',
  issues: [
    { id: 'high-1', title: 'Unsafe input', severity: 'high', category: 'security', message: 'Input is trusted.', suggestion: 'Validate input.', file: 'src/a.ts', startLine: 4, endLine: 5 },
    { id: 'low-1', title: 'Hard to read', severity: 'low', category: 'best_practice', message: 'Name is vague.', suggestion: 'Rename it.', file: 'src/b.ts', startLine: 8, endLine: 8 },
  ],
  metadata: { mode: 'diff', reviewedAt: '2026-08-11T00:00:00.000Z', issueCount: 2 },
};

describe('review tree model', () => {
  it('shows explicit idle, loading, error, and empty states', () => {
    expect(buildReviewTree({ status: 'idle' })[0].label).toBe('Run a review to see results.');
    expect(buildReviewTree({ status: 'loading', target: 'diff', lastTarget: 'diff' })[0].label).toBe('Reviewing Git diff…');
    expect(buildReviewTree({ status: 'error', message: 'Offline.' })[0]).toMatchObject({ label: 'Review failed', description: 'Offline.' });
    expect(buildReviewTree({ status: 'empty', result: { ...reviewed, issues: [], metadata: { ...reviewed.metadata, issueCount: 0 } }, lastTarget: 'diff' }).map((node) => node.label)).toEqual(['Summary', 'No issues found.']);
  });

  it('builds summary and stable severity groups with issue metadata and commands', () => {
    const tree = buildReviewTree({ status: 'success', result: reviewed, lastTarget: 'diff' });
    expect(tree.map((node) => node.id)).toEqual(['summary', 'severity-high', 'severity-medium', 'severity-low']);
    expect(tree.slice(1).map((node) => node.label)).toEqual(['High (1)', 'Medium (0)', 'Low (1)']);
    expect(tree[1].children?.[0]).toMatchObject({
      id: 'issue-high-1',
      label: 'Unsafe input',
      description: 'security • src/a.ts:4–5',
      command: { id: 'reviewPilot.openIssue', arguments: [reviewed.issues[0]] },
    });
    expect(tree[1].children?.[0].tooltip).toContain('Suggestion: Validate input.');
  });
});
