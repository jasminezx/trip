import { describe, expect, it } from 'vitest';

import { ConfigurationError } from './errors';
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

  it('rejects invalid maxIssues before invoking the completion client', async () => {
    let completions = 0;
    const service = new ReviewService({ complete: async () => {
      completions += 1;
      return '{"summary":"No issues", "issues":[]}';
    } });

    await expect(service.review(
      { mode: 'file', content: 'const valid = true;', filePath: 'src/valid.ts' },
      { maxIssues: 0 },
    )).rejects.toBeInstanceOf(ConfigurationError);
    expect(completions).toBe(0);
  });
});
