import type { ReviewMode, ReviewRequest, ReviewRunResult } from '../core/types';
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
      const message = errorMessage(error);
      this.dependencies.store.fail(message);
      this.dependencies.reportError?.(message);
      this.dependencies.log?.('Review failed.');
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
}
