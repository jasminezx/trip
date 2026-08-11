import { describe, expect, it } from 'vitest';

import { buildReviewPrompt } from './reviewPrompt';

describe('buildReviewPrompt', () => {
  it.each([
    ['selection', 'selected code', 'src/math.ts'],
    ['file', 'entire file', 'src/math.ts'],
    ['diff', 'Git diff', ''],
  ] as const)('states the %s review target and emits a JSON-only actionable request', (mode, target, filePath) => {
    const prompt = buildReviewPrompt({ mode, content: 'const total = input;', filePath, language: 'typescript' }, 3);

    expect(prompt.system).toContain('concrete, actionable findings');
    expect(prompt.system).toContain('strict JSON only');
    expect(prompt.user).toContain(target);
    expect(prompt.user).toContain('Maximum issues: 3');
    expect(prompt.user).toContain('const total = input;');
  });

  it('defines selection coordinates relative to the supplied content and includes the absolute file-line origin', () => {
    const prompt = buildReviewPrompt({
      mode: 'selection', content: 'first();\nsecond();', filePath: 'src/run.ts', selectionStartLine: 41,
    }, 3);

    expect(prompt.user).toContain('line 1 of the supplied selection is line 41 in the complete file');
    expect(prompt.user).toContain('return one-based line numbers relative to the supplied selection');
  });

  it('defines repository-relative post-change coordinates for unified diffs', () => {
    const prompt = buildReviewPrompt({
      mode: 'diff', content: 'diff --git a/src/run.ts b/src/run.ts\n@@ -3 +3 @@\n-old\n+new',
    }, 3);

    expect(prompt.user).toContain('repository-relative');
    expect(prompt.user).toContain('without a/ or b/ prefixes');
    expect(prompt.user).toContain('one-based post-change file lines');
  });
});
