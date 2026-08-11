import { describe, expect, it } from 'vitest';
import type { ReviewRunResult } from '../core/types';
import { ReviewStore } from './reviewStore';

const result = (issueCount: number): ReviewRunResult => ({
  summary: issueCount ? 'One concern.' : 'Looks good.',
  issues: issueCount ? [{
    id: 'issue-1', title: 'Concern', severity: 'high', category: 'bug', message: 'Broken.',
    suggestion: 'Fix it.', file: 'src/a.ts', startLine: 2, endLine: 3,
  }] : [],
  metadata: { mode: 'file', reviewedAt: '2026-08-11T00:00:00.000Z', issueCount },
});

describe('ReviewStore', () => {
  it('publishes loading and success states while tracking the last valid target', () => {
    const store = new ReviewStore();
    const statuses: string[] = [];
    store.subscribe((state) => statuses.push(state.status));

    store.start('file');
    store.complete(result(1));

    expect(statuses).toEqual(['loading', 'success']);
    expect(store.getState()).toMatchObject({ status: 'success', lastTarget: 'file' });
  });

  it('uses a distinct empty state for a successful review with no issues', () => {
    const store = new ReviewStore();
    store.start('file');
    store.complete(result(0));
    expect(store.getState()).toMatchObject({ status: 'empty', result: result(0) });
  });

  it('reports a preflight error without replacing the previous valid target', () => {
    const store = new ReviewStore();
    store.start('diff');
    store.fail('Request failed.');
    store.fail('Select some code to review.');
    expect(store.getState()).toEqual({
      status: 'error',
      message: 'Select some code to review.',
      lastTarget: 'diff',
    });
  });

  it('stops notifying a disposed subscription', () => {
    const store = new ReviewStore();
    let notifications = 0;
    const subscription = store.subscribe(() => { notifications += 1; });
    subscription.dispose();
    store.start('file');
    expect(notifications).toBe(0);
  });
});
