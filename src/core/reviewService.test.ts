import { describe, expect, it } from 'vitest';

import { ReviewService } from './reviewService';

describe('ReviewService', () => {
  it('coordinates the prompt, model result, parser, and review metadata', async () => {
    const service = new ReviewService({ complete: async (prompt) => {
      expect(prompt.user).toContain('selected code');
      return '{"summary":"One issue", "issues":[{"title":"Bug","severity":"high","category":"bug","message":"Returns the wrong value.","suggestion":"Return the computed total.","file":"","startLine":2,"endLine":2}]}';
    } }, () => new Date('2026-08-11T04:00:00.000Z'));

    await expect(service.review(
      { mode: 'selection', content: 'return 0;', filePath: 'src/total.ts', language: 'typescript' },
      { maxIssues: 4 },
    )).resolves.toMatchObject({
      summary: 'One issue',
      issues: [{ file: 'src/total.ts', severity: 'high' }],
      metadata: { mode: 'selection', reviewedAt: '2026-08-11T04:00:00.000Z', issueCount: 1 },
    });
  });
});
