import { resolveChatCompletionsEndpoint, validateAiConfiguration, type AiConfiguration } from './aiConfig';
import { ApiError, ResponseError } from './errors';
import type { ReviewPrompt } from './reviewPrompt';

export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

export interface Clock {
  setTimeout(callback: () => void, milliseconds: number): ReturnType<typeof setTimeout>;
  clearTimeout(handle: ReturnType<typeof setTimeout>): void;
}

const systemClock: Clock = { setTimeout, clearTimeout };
const MAX_ERROR_DETAIL_LENGTH = 500;

export class ChatCompletionsClient {
  private readonly configuration: AiConfiguration;

  public constructor(
    configuration: AiConfiguration,
    private readonly fetch: FetchFunction = globalThis.fetch.bind(globalThis),
    private readonly clock: Clock = systemClock,
  ) {
    this.configuration = validateAiConfiguration(configuration);
  }

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
        const message = `Review request timed out after ${this.configuration.timeoutMs}ms.`;
        throw new ApiError(message, undefined, error, message);
      }
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Network request failed: ${this.sanitizeErrorDetail(detail)}`;
      throw new ApiError(message, undefined, error, message);
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
    const message = `Review API request failed (${response.status}): ${this.sanitizeErrorDetail(detail || response.statusText)}`;
    return new ApiError(message, response.status, undefined, message);
  }

  private sanitizeErrorDetail(detail: string): string {
    const redacted = detail
      .split(this.configuration.apiKey).join('[REDACTED]')
      .replace(/[\u0000-\u001f\u007f\s]+/g, ' ')
      .trim();
    return redacted.length <= MAX_ERROR_DETAIL_LENGTH
      ? redacted
      : `${redacted.slice(0, MAX_ERROR_DETAIL_LENGTH - 1)}…`;
  }

  private async extractContent(response: Response): Promise<string> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ResponseError('Review API returned invalid JSON.');
    }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
      throw new ResponseError('Review API response did not include message content.');
    }
    const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ResponseError('Review API response did not include message content.');
    }
    return content;
  }
}
