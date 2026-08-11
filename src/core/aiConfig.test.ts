import { describe, expect, it } from 'vitest';

import { ConfigurationError } from './errors';
import { resolveChatCompletionsEndpoint, validateAiConfiguration } from './aiConfig';

describe('AI configuration', () => {
  it.each([
    ['https://example.test', 'https://example.test/v1/chat/completions'],
    ['https://example.test/v1/', 'https://example.test/v1/chat/completions'],
    ['https://example.test/v1/chat/completions/', 'https://example.test/v1/chat/completions'],
    ['http://localhost:11434', 'http://localhost:11434/v1/chat/completions'],
    ['http://127.0.0.1:11434/v1', 'http://127.0.0.1:11434/v1/chat/completions'],
    ['http://127.42.0.9:11434', 'http://127.42.0.9:11434/v1/chat/completions'],
    ['http://[::1]:11434', 'http://[::1]:11434/v1/chat/completions'],
    ['http://[0:0:0:0:0:0:0:1]:11434', 'http://[::1]:11434/v1/chat/completions'],
  ])('resolves %s to the Chat Completions endpoint', (baseUrl, endpoint) => {
    expect(resolveChatCompletionsEndpoint(baseUrl)).toBe(endpoint);
  });

  it.each([
    'http://example.test',
    'http://192.168.1.10:11434',
    'http://localhost.example.test',
  ])('rejects non-loopback cleartext endpoint %s', (baseUrl) => {
    expect(() => resolveChatCompletionsEndpoint(baseUrl)).toThrow('HTTPS');
  });

  it('trims valid configuration values and rejects unusable credentials or limits', () => {
    expect(validateAiConfiguration({
      apiKey: ' token ', baseUrl: ' https://example.test/v1/ ', model: ' model ', language: ' auto ', maxIssues: 2, maxInputBytes: 100_000, timeoutMs: 1_000,
    })).toEqual({
      apiKey: 'token', baseUrl: 'https://example.test/v1', model: 'model', language: 'auto', maxIssues: 2, maxInputBytes: 100_000, timeoutMs: 1_000,
    });

    expect(() => validateAiConfiguration({
      apiKey: '', baseUrl: 'ftp://example.test', model: '', language: '', maxIssues: 0, maxInputBytes: 999, timeoutMs: 999,
    })).toThrow(ConfigurationError);
  });
});
