import { describe, expect, it } from 'vitest';
import type { ReviewMode, ReviewRequest, ReviewRunResult } from '../core/types';
import { ApiError, ConfigurationError } from '../core/errors';
import { collectSelectionRequest } from './reviewContext';
import { ReviewController } from './reviewController';
import { buildReviewTree } from './treeModel';
import { ReviewStore } from './reviewStore';

const request = (mode: ReviewMode): ReviewRequest => ({ mode, content: 'content' });
const result = (mode: ReviewMode): ReviewRunResult => ({
  summary: 'Done.', issues: [], metadata: { mode, reviewedAt: '2026-08-11T00:00:00.000Z', issueCount: 0 },
});

describe('ReviewController', () => {
  it('prevents overlapping reviews before a second context is collected', async () => {
    let release!: (value: ReviewRunResult) => void;
    const pending = new Promise<ReviewRunResult>((resolve) => { release = resolve; });
    const collected: ReviewMode[] = [];
    const busyMessages: string[] = [];
    const controller = new ReviewController({
      collect: async (mode) => { collected.push(mode); return request(mode); },
      review: async () => pending,
      store: new ReviewStore(),
      reportBusy: (message) => busyMessages.push(message),
    });

    const first = controller.run('file');
    await Promise.resolve();
    await controller.run('diff');
    release(result('file'));
    await first;

    expect(collected).toEqual(['file']);
    expect(busyMessages).toEqual(['A review is already in progress.']);
  });

  it('refreshes the last target whose context collection succeeded', async () => {
    const reviewed: ReviewMode[] = [];
    const store = new ReviewStore();
    const controller = new ReviewController({
      collect: async (mode) => request(mode),
      review: async (reviewRequest) => { reviewed.push(reviewRequest.mode); return result(reviewRequest.mode); },
      store,
    });

    await controller.run('selection');
    await controller.refresh();
    expect(reviewed).toEqual(['selection', 'selection']);
  });

  it('does not replace the refresh target when context collection fails', async () => {
    const reviewed: ReviewMode[] = [];
    const store = new ReviewStore();
    const controller = new ReviewController({
      collect: async (mode) => {
        if (mode === 'selection') throw new Error('Select some code to review.');
        return request(mode);
      },
      review: async (reviewRequest) => { reviewed.push(reviewRequest.mode); return result(reviewRequest.mode); },
      store,
    });

    await controller.run('file');
    await controller.run('selection');
    await controller.refresh();
    expect(reviewed).toEqual(['file', 'file']);
    expect(store.getLastTarget()).toBe('file');
  });

  it('guides configuration errors to settings without exposing configuration values', async () => {
    const messages: string[] = [];
    let guidance = 0;
    const store = new ReviewStore();
    const controller = new ReviewController({
      collect: async (mode) => request(mode),
      review: async () => { throw new ConfigurationError('API key is required.'); },
      store,
      reportError: (message) => messages.push(message),
      offerConfiguration: () => { guidance += 1; },
    });

    await controller.run('file');
    expect(store.getState()).toMatchObject({ status: 'error', message: 'API key is required.' });
    expect(messages).toEqual(['API key is required.']);
    expect(guidance).toBe(1);
  });

  it('reports refresh guidance when no valid target exists', async () => {
    const messages: string[] = [];
    const controller = new ReviewController({
      collect: async (mode) => request(mode), review: async ({ mode }) => result(mode),
      store: new ReviewStore(), reportError: (message) => messages.push(message),
    });
    await controller.refresh();
    expect(messages).toEqual(['Run a review before refreshing results.']);
  });

  it('keeps validation errors actionable for the user', async () => {
    const messages: string[] = [];
    const controller = new ReviewController({
      collect: async () => collectSelectionRequest(undefined),
      review: async ({ mode }) => result(mode),
      store: new ReviewStore(),
      reportError: (message) => messages.push(message),
    });
    await controller.run('selection');
    expect(messages).toEqual(['Open a file and select code to review.']);
  });

  it('summarizes API failures without trusting their exception text', async () => {
    const logs: string[] = [];
    const store = new ReviewStore();
    const controller = new ReviewController({
      collect: async (mode) => request(mode),
      review: async () => { throw new ApiError('Network request failed with sk-secret-value', 502); },
      store,
      log: (message) => logs.push(message),
    });
    await controller.run('file');
    expect(store.getState()).toMatchObject({
      status: 'error', message: 'Review failed. See the Review Pilot output for details.',
    });
    expect(logs).toEqual([
      'Started file review.',
      'Review API request failed (HTTP 502).',
    ]);
  });

  it('never exposes arbitrary exception details in output, state, notifications, or the tree', async () => {
    const logs: string[] = [];
    const messages: string[] = [];
    const store = new ReviewStore();
    const controller = new ReviewController({
      collect: async (mode) => request(mode),
      review: async () => { throw new Error('request contained sk-secret-value'); },
      store,
      reportError: (message) => messages.push(message),
      log: (message) => logs.push(message),
    });

    await controller.run('file');
    expect(logs).toEqual(['Started file review.', 'Review failed.']);
    expect(messages).toEqual(['Review failed. See the Review Pilot output for details.']);
    expect(store.getState()).toEqual({
      status: 'error', message: 'Review failed. See the Review Pilot output for details.', lastTarget: 'file',
    });
    expect(buildReviewTree(store.getState())[0].description).not.toContain('sk-secret-value');
  });
});
