import { describe, expect, it } from 'vitest';
import type { ReviewMode, ReviewRequest, ReviewRunResult } from '../core/types';
import { ReviewController } from './reviewController';
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
      review: async () => { throw Object.assign(new Error('API key is required.'), { code: 'configuration' }); },
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

  it('never writes exception details to the output log', async () => {
    const logs: string[] = [];
    const controller = new ReviewController({
      collect: async (mode) => request(mode),
      review: async () => { throw new Error('request contained sk-secret-value'); },
      store: new ReviewStore(),
      log: (message) => logs.push(message),
    });

    await controller.run('file');
    expect(logs).toEqual(['Started file review.', 'Review failed.']);
  });
});
