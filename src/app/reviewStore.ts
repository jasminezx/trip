import type { ReviewMode, ReviewRunResult } from '../core/types';

export type ReviewState =
  | { status: 'idle'; lastTarget?: ReviewMode }
  | { status: 'loading'; target: ReviewMode; lastTarget: ReviewMode }
  | { status: 'success'; result: ReviewRunResult; lastTarget: ReviewMode }
  | { status: 'empty'; result: ReviewRunResult; lastTarget: ReviewMode }
  | { status: 'error'; message: string; lastTarget?: ReviewMode };

export interface Disposable {
  dispose(): void;
}

export class ReviewStore {
  private state: ReviewState = { status: 'idle' };
  private readonly listeners = new Set<(state: ReviewState) => void>();

  public getState(): ReviewState {
    return this.state;
  }

  public getLastTarget(): ReviewMode | undefined {
    return this.state.lastTarget;
  }

  public start(target: ReviewMode): void {
    this.publish({ status: 'loading', target, lastTarget: target });
  }

  public complete(result: ReviewRunResult): void {
    const lastTarget = this.state.lastTarget ?? result.metadata.mode;
    this.publish({ status: result.issues.length ? 'success' : 'empty', result, lastTarget });
  }

  public fail(message: string): void {
    this.publish({ status: 'error', message, lastTarget: this.state.lastTarget });
  }

  public subscribe(listener: (state: ReviewState) => void): Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  private publish(state: ReviewState): void {
    this.state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }
}
