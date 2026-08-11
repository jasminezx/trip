import { validateMaxIssues } from './aiConfig';
import { DEFAULT_MAX_INPUT_BYTES } from './constants';
import { ConfigurationError, ReviewInputError } from './errors';
import { buildReviewPrompt } from './reviewPrompt';
import { parseReviewResponse } from './reviewParser';
import type { ReviewRequest, ReviewRunResult } from './types';

export interface ReviewCompletionClient {
  complete(prompt: ReturnType<typeof buildReviewPrompt>): Promise<string>;
}

export class ReviewService {
  public constructor(
    private readonly client: ReviewCompletionClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async review(request: ReviewRequest, options: { maxIssues: number; maxInputBytes?: number }): Promise<ReviewRunResult> {
    const maxIssues = validateMaxIssues(options.maxIssues);
    const maxInputBytes = options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES;
    if (!Number.isInteger(maxInputBytes) || maxInputBytes < 1) {
      throw new ConfigurationError('Maximum input size must be a positive integer number of UTF-8 bytes.');
    }
    const inputBytes = new TextEncoder().encode(request.content).byteLength;
    if (inputBytes > maxInputBytes) {
      throw new ReviewInputError(`Review input is ${inputBytes} UTF-8 bytes; maximum is ${maxInputBytes} bytes.`);
    }
    const prompt = buildReviewPrompt(request, maxIssues);
    const raw = await this.client.complete(prompt);
    const parsed = parseReviewResponse(raw, {
      defaultFile: request.filePath,
      maxIssues,
      mode: request.mode,
      lineOffset: request.mode === 'selection' ? Math.max(0, (request.selectionStartLine ?? 1) - 1) : 0,
    });
    const issues = request.navigationFilePath
      ? parsed.issues.map((issue) => ({ ...issue, navigationFilePath: request.navigationFilePath }))
      : parsed.issues;
    return {
      ...parsed,
      issues,
      metadata: { mode: request.mode, reviewedAt: this.now().toISOString(), issueCount: issues.length },
    };
  }
}
