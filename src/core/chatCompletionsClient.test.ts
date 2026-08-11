import { describe, expect, it } from 'vitest';

import { ApiError, ConfigurationError, ResponseError } from './errors';
import { ChatCompletionsClient } from './chatCompletionsClient';

const configuration = { apiKey: 'test-token', baseUrl: 'https://example.test', model: 'review-model', language: 'auto', maxIssues: 3, maxInputBytes: 100_000, timeoutMs: 1_000 };
const prompt = { system: 'System instruction', user: 'User content' };

describe('ChatCompletionsClient', () => {
  it('sends an OpenAI-compatible JSON request and extracts message content', async () => {
    let request: { url: string; init: RequestInit } | undefined;
    const client = new ChatCompletionsClient(configuration, async (url, init) => {
      request = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"issues":[]}' } }] }), { status: 200 });
    });

    await expect(client.complete(prompt)).resolves.toBe('{"issues":[]}');
    expect(request?.url).toBe('https://example.test/v1/chat/completions');
    expect(request?.init.headers).toMatchObject({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' });
    expect(JSON.parse(request?.init.body as string)).toMatchObject({
      model: 'review-model', response_format: { type: 'json_object' }, messages: [{ role: 'system', content: 'System instruction' }, { role: 'user', content: 'User content' }],
    });
  });

  it('reports HTTP details, malformed responses, and nested network causes', async () => {
    const httpClient = new ChatCompletionsClient(configuration, async () => new Response('{"error":{"message":"quota exhausted"}}', { status: 429 }));
    await expect(httpClient.complete(prompt)).rejects.toThrow('429');
    await expect(httpClient.complete(prompt)).rejects.toThrow('quota exhausted');

    const malformedClient = new ChatCompletionsClient(configuration, async () => new Response('{"choices":[]}', { status: 200 }));
    await expect(malformedClient.complete(prompt)).rejects.toBeInstanceOf(ResponseError);

    const cause = new Error('socket closed');
    const networkClient = new ChatCompletionsClient(configuration, async () => { throw cause; });
    await expect(networkClient.complete(prompt)).rejects.toMatchObject({ cause });
  });

  it('classifies a JSON null success payload as a response error', async () => {
    const client = new ChatCompletionsClient(
      configuration,
      async () => new Response('null', { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );

    await expect(client.complete(prompt)).rejects.toBeInstanceOf(ResponseError);
    await expect(client.complete(prompt)).rejects.toThrow('response did not include message content');
  });

  it('marks only bounded redacted client diagnostics as safe for presentation', async () => {
    const secret = configuration.apiKey;
    const client = new ChatCompletionsClient(
      configuration,
      async () => new Response(JSON.stringify({
        error: { message: `quota exhausted for model review-model using ${secret} ${'x'.repeat(2_000)}` },
      }), { status: 429 }),
    );

    const error = await client.complete(prompt).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 429 });
    const publicMessage = (error as ApiError).publicMessage ?? '';
    expect(publicMessage).toContain('quota exhausted for model review-model');
    expect(publicMessage).toContain('[REDACTED]');
    expect(publicMessage).not.toContain(secret);
    expect(publicMessage.length).toBeLessThan(600);
  });

  it('rejects a non-loopback HTTP endpoint before invoking fetch', () => {
    let fetchCalls = 0;
    expect(() => new ChatCompletionsClient(
      { ...configuration, baseUrl: 'http://api.example.test' },
      async () => { fetchCalls += 1; return new Response(); },
    )).toThrow('HTTPS');
    expect(fetchCalls).toBe(0);
  });

  it('redacts the configured API key and bounds untrusted HTTP error detail', async () => {
    const secret = 'secret-that-must-not-leak';
    const client = new ChatCompletionsClient(
      { ...configuration, apiKey: secret },
      async () => new Response(`${secret}\n${'x'.repeat(2_000)}`, { status: 502 }),
    );

    let thrown: unknown;
    try {
      await client.complete(prompt);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    const message = (thrown as Error).message;
    expect(message).not.toContain(secret);
    expect(message).not.toContain('\n');
    expect(message.length).toBeLessThan(600);
  });

  it('redacts the configured API key from network exception details', async () => {
    const secret = 'network-secret-that-must-not-leak';
    const client = new ChatCompletionsClient(
      { ...configuration, apiKey: secret },
      async () => { throw new Error(`socket failed with ${secret}`); },
    );

    let thrown: unknown;
    try {
      await client.complete(prompt);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ApiError);
    expect((thrown as Error).message).toContain('[REDACTED]');
    expect((thrown as Error).message).not.toContain(secret);
  });

  it('rejects invalid configuration before invoking fetch', () => {
    let fetchCalls = 0;

    expect(() => new ChatCompletionsClient(
      { ...configuration, apiKey: '' },
      async () => { fetchCalls += 1; return new Response(); },
    )).toThrow(ConfigurationError);
    expect(fetchCalls).toBe(0);
  });

  it('aborts the injected request when the configured timeout expires', async () => {
    let aborted = false;
    const client = new ChatCompletionsClient(configuration, (_url, init) => new Promise((_resolve, reject) => {
      if (init.signal?.aborted) {
        aborted = true;
        reject(new Error('aborted'));
        return;
      }
      init.signal?.addEventListener('abort', () => { aborted = true; reject(new Error('aborted')); });
    }), {
      setTimeout: (callback, _milliseconds) => { callback(); return setTimeout(() => undefined, 0); },
      clearTimeout: (handle) => clearTimeout(handle),
    });

    await expect(client.complete(prompt)).rejects.toThrow('timed out');
    expect(aborted).toBe(true);
  });
});
