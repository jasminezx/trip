import { describe, expect, it } from 'vitest';

import { ResponseError } from './errors';
import { parseReviewResponse } from './reviewParser';

describe('parseReviewResponse', () => {
  it('parses fenced JSON and normalizes recoverable issue fields', () => {
    const result = parseReviewResponse('```json\n{"summary":"Check input", "issues":[{"title":" Missing validation ","severity":"urgent","category":"style","message":" Input reaches command execution. ","suggestion":" Validate it. ","file":" ","startLine":"-2","endLine":0}]}\n```', {
      defaultFile: 'src/run.ts', maxIssues: 5,
    });

    expect(result).toMatchObject({
      summary: 'Check input',
      issues: [{
        title: 'Missing validation', severity: 'medium', category: 'maintainability',
        message: 'Input reaches command execution.', suggestion: 'Validate it.', file: 'src/run.ts', startLine: 1, endLine: 1,
      }],
    });
  });

  it('rejects malformed top-level output and limits the returned issues', () => {
    expect(() => parseReviewResponse('[]', { maxIssues: 2 })).toThrow(ResponseError);

    const result = parseReviewResponse(JSON.stringify({ issues: [
      { title: 'One', message: 'One', suggestion: 'Fix', file: 'a.ts', startLine: 1, endLine: 1 },
      { title: 'Two', message: 'Two', suggestion: 'Fix', file: 'a.ts', startLine: 2, endLine: 2 },
      { title: 'Three', message: 'Three', suggestion: 'Fix', file: 'a.ts', startLine: 3, endLine: 3 },
    ] }), { maxIssues: 2 });

    expect(result.issues.map((issue) => issue.title)).toEqual(['One', 'Two']);
  });
});
