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

  public async review(request: ReviewRequest, options: { maxIssues: number }): Promise<ReviewRunResult> {
    const prompt = buildReviewPrompt(request, options.maxIssues);
    const raw = await this.client.complete(prompt);
    const result = parseReviewResponse(raw, { defaultFile: request.filePath, maxIssues: options.maxIssues });
    return {
      ...result,
      metadata: { mode: request.mode, reviewedAt: this.now().toISOString(), issueCount: result.issues.length },
    };
  }
}
