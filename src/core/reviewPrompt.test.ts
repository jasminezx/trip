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
});
