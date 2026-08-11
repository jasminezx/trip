import { resolveChatCompletionsEndpoint, type AiConfiguration } from './aiConfig';
import { ApiError, ResponseError } from './errors';
import type { ReviewPrompt } from './reviewPrompt';

export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

export interface Clock {
  setTimeout(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const systemClock: Clock = { setTimeout, clearTimeout };

export class ChatCompletionsClient {
  public constructor(
    private readonly configuration: AiConfiguration,
    private readonly fetch: FetchFunction = globalThis.fetch.bind(globalThis),
    private readonly clock: Clock = systemClock,
  ) {}

  public async complete(prompt: ReviewPrompt): Promise<string> {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = this.clock.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.configuration.timeoutMs);

    try {
      const response = await this.fetch(resolveChatCompletionsEndpoint(this.configuration.baseUrl), {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.configuration.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.configuration.model,
          messages: [{ role: 'system', content: prompt.system }, { role: 'user', content: prompt.user }],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw await this.httpError(response);
      }
      return await this.extractContent(response);
    } catch (error) {
      if (error instanceof ApiError || error instanceof ResponseError) {
        throw error;
      }
      if (timedOut) {
        throw new ApiError(`Review request timed out after ${this.configuration.timeoutMs}ms.`, undefined, error);
      }
      const detail = error instanceof Error ? error.message : String(error);
      throw new ApiError(`Network request failed: ${detail}`, undefined, error);
    } finally {
      this.clock.clearTimeout(timeout);
    }
  }

  private async httpError(response: Response): Promise<ApiError> {
    const text = await response.text();
    let detail = text;
    try {
      const payload = JSON.parse(text) as { error?: { message?: unknown } };
      if (typeof payload.error?.message === 'string') {
        detail = payload.error.message;
      }
    } catch {
      // Keep the response text when the error body is not JSON.
    }
    return new ApiError(`Review API request failed (${response.status}): ${detail || response.statusText}`, response.status);
  }

  private async extractContent(response: Response): Promise<string> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ResponseError('Review API returned invalid JSON.');
    }
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })
      .choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ResponseError('Review API response did not include message content.');
    }
    return content;
  }
}
