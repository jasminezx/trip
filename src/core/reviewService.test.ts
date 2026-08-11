import { describe, expect, it } from 'vitest';

import { ConfigurationError } from './errors';
import { ReviewService } from './reviewService';
import { collectSelectionRequest } from '../app/reviewContext';
import { issueLineRange, resolveIssueFile } from '../app/issueLocation';

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

  it('maps selection-relative model lines to complete-file lines and retains trusted navigation metadata', async () => {
    const request = collectSelectionRequest({
      documentText: Array.from({ length: 50 }, (_, index) => `line ${index + 1}`).join('\n'),
      selectionText: 'line 41\nline 42',
      filePath: 'C:\\repo\\src\\answer.ts',
      workspaceRoots: ['C:\\repo'],
      selectionStartLine: 41,
      language: 'typescript',
    });
    const service = new ReviewService({ complete: async () => (
      '{"summary":"One issue","issues":[{"title":"Bug","severity":"high","category":"bug","message":"Wrong value.","suggestion":"Fix it.","file":"src/answer.ts","startLine":2,"endLine":2}]}'
    ) });

    const result = await service.review(request, { maxIssues: 4, maxInputBytes: 100_000 });

    expect(result.issues[0]).toMatchObject({
      file: 'src/answer.ts', startLine: 42, endLine: 42,
      navigationFilePath: 'C:\\repo\\src\\answer.ts',
    });
    expect(issueLineRange(result.issues[0])).toEqual({ startLine: 41, endLine: 41 });
  });

  it('normalizes real unified-diff paths and preserves post-change lines for navigation', async () => {
    const service = new ReviewService({ complete: async () => (
      '{"summary":"One issue","issues":[{"title":"Bug","severity":"high","category":"bug","message":"Wrong value.","suggestion":"Fix it.","file":"b/src/answer.ts","startLine":8,"endLine":9}]}'
    ) });
    const result = await service.review({
      mode: 'diff',
      content: 'diff --git a/src/answer.ts b/src/answer.ts\nindex 111..222 100644\n--- a/src/answer.ts\n+++ b/src/answer.ts\n@@ -7,2 +7,3 @@\n old\n+new',
    }, { maxIssues: 4, maxInputBytes: 100_000 });

    expect(result.issues[0]).toMatchObject({ file: 'src/answer.ts', startLine: 8, endLine: 9 });
    expect(resolveIssueFile(result.issues[0].file, { workspaceRoots: ['C:\\repo'] }))
      .toBe('C:\\repo\\src\\answer.ts');
    expect(issueLineRange(result.issues[0])).toEqual({ startLine: 7, endLine: 8 });
  });

  it('only strips a/ and b/ prefixes for files present in the collected diff', async () => {
    const service = new ReviewService({ complete: async () => (
      '{"summary":"Mixed paths","issues":[' +
      '{"title":"Keep","severity":"low","category":"best_practice","message":"Keep prefix.","suggestion":"Keep it.","file":"a/service.ts", "startLine":1, "endLine":1},' +
      '{"title":"Strip","severity":"low","category":"best_practice","message":"Strip prefix.","suggestion":"Strip it.","file":"b/src/answer.ts", "startLine":2, "endLine":2}]}'
    ) });
    const result = await service.review({
      mode: 'diff',
      content: [
        'diff --git a/a/service.ts b/a/service.ts',
        'index 111..222 100644',
        '--- a/a/service.ts',
        '+++ b/a/service.ts',
        '@@ -1,1 +1,1 @@',
        ' old',
        '+new',
        'diff --git a/src/answer.ts b/src/answer.ts',
        'index 111..222 100644',
        '--- a/src/answer.ts',
        '+++ b/src/answer.ts',
        '@@ -1,1 +1,1 @@',
        ' old',
        '+new',
      ].join('\n'),
    }, { maxIssues: 4, maxInputBytes: 100_000 });

    expect(result.issues.map((issue) => issue.file)).toEqual(['a/service.ts', 'src/answer.ts']);
  });

  it('enforces a UTF-8 byte limit before invoking the completion client', async () => {
    let completions = 0;
    const service = new ReviewService({ complete: async () => {
      completions += 1;
      return '{"summary":"No issues","issues":[]}';
    } });

    await expect(service.review(
      { mode: 'file', content: 'éé', filePath: 'src/exact.ts' },
      { maxIssues: 4, maxInputBytes: 4 },
    )).resolves.toMatchObject({ issues: [] });
    for (const mode of ['selection', 'file', 'diff'] as const) {
      await expect(service.review(
        { mode, content: 'ééa', filePath: 'src/large.ts' },
        { maxIssues: 4, maxInputBytes: 4 },
      )).rejects.toThrow('Review input is 5 UTF-8 bytes; maximum is 4 bytes.');
    }
    expect(completions).toBe(1);
  });
});
