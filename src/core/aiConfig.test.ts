import { describe, expect, it } from 'vitest';

import { ConfigurationError } from './errors';
import { resolveChatCompletionsEndpoint, validateAiConfiguration } from './aiConfig';

describe('AI configuration', () => {
  it.each([
    ['https://example.test', 'https://example.test/v1/chat/completions'],
    ['https://example.test/v1/', 'https://example.test/v1/chat/completions'],
    ['https://example.test/v1/chat/completions/', 'https://example.test/v1/chat/completions'],
  ])('resolves %s to the Chat Completions endpoint', (baseUrl, endpoint) => {
    expect(resolveChatCompletionsEndpoint(baseUrl)).toBe(endpoint);
  });

  it('trims valid configuration values and rejects unusable credentials or limits', () => {
    expect(validateAiConfiguration({
      apiKey: ' token ', baseUrl: ' https://example.test/v1/ ', model: ' model ', language: ' auto ', maxIssues: 2, timeoutMs: 1_000,
    })).toEqual({
      apiKey: 'token', baseUrl: 'https://example.test/v1', model: 'model', language: 'auto', maxIssues: 2, timeoutMs: 1_000,
    });

    expect(() => validateAiConfiguration({
      apiKey: '', baseUrl: 'ftp://example.test', model: '', language: '', maxIssues: 0, timeoutMs: 999,
    })).toThrow(ConfigurationError);
  });
});
