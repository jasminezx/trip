import type { ReviewMode, ReviewRequest, ReviewRunResult } from '../core/types';
import { ApiError, ConfigurationError, ResponseError, ReviewInputError } from '../core/errors';
import { ReviewContextError } from './reviewContext';
import type { ReviewStore } from './reviewStore';

export interface ReviewControllerDependencies {
  collect(mode: ReviewMode): Promise<ReviewRequest>;
  review(request: ReviewRequest): Promise<ReviewRunResult>;
  store: ReviewStore;
  reportBusy?(message: string): void;
  reportError?(message: string): void;
  offerConfiguration?(): void;
  log?(message: string): void;
}

const GENERIC_REVIEW_ERROR = 'Review failed. See the Review Pilot output for details.';

function safeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.publicMessage ?? GENERIC_REVIEW_ERROR;
  }
  return error instanceof ConfigurationError || error instanceof ResponseError
    || error instanceof ReviewContextError || error instanceof ReviewInputError
    ? error.message
    : GENERIC_REVIEW_ERROR;
}

function safeErrorDetail(error: unknown): string | undefined {
  if (error instanceof ApiError) {
    if (error.publicMessage) {
      return error.publicMessage;
    }
    return error.status === undefined
      ? 'Review API request failed.'
      : `Review API request failed (HTTP ${error.status}).`;
  }
  if (error instanceof ConfigurationError || error instanceof ResponseError
    || error instanceof ReviewContextError || error instanceof ReviewInputError) {
    return `Review failed: ${error.message}`;
  }
  return undefined;
}

function isConfigurationError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === 'configuration';
}

export class ReviewController {
  private running = false;

  public constructor(private readonly dependencies: ReviewControllerDependencies) {}

  public async run(mode: ReviewMode): Promise<void> {
    if (this.running) {
      this.dependencies.reportBusy?.('A review is already in progress.');
      return;
    }
    this.running = true;
    try {
      const request = await this.dependencies.collect(mode);
      this.dependencies.store.start(mode);
      this.dependencies.log?.(`Started ${mode} review.`);
      const result = await this.dependencies.review(request);
      this.dependencies.store.complete(result);
      this.dependencies.log?.(`Completed ${mode} review with ${result.issues.length} issue(s).`);
    } catch (error) {
      const message = safeErrorMessage(error);
      this.dependencies.store.fail(message);
      this.dependencies.reportError?.(message);
      const detail = safeErrorDetail(error);
      this.dependencies.log?.(detail ?? 'Review failed.');
      if (isConfigurationError(error)) {
        this.dependencies.offerConfiguration?.();
      }
    } finally {
      this.running = false;
    }
  }

  public async refresh(): Promise<void> {
    const target = this.dependencies.store.getLastTarget();
    if (!target) {
      this.dependencies.reportError?.('Run a review before refreshing results.');
      return;
    }
    await this.run(target);
  }

  public async runDefault(readMode: () => ReviewMode): Promise<void> {
    await this.run(readMode());
  }
}
