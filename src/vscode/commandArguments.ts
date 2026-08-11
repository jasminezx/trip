import type { ReviewIssue } from '../core/types';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isReviewIssue(value: unknown): value is ReviewIssue {
  if (!isObject(value)) {
    return false;
  }
  return typeof value.id === 'string'
    && typeof value.title === 'string'
    && (value.severity === 'high' || value.severity === 'medium' || value.severity === 'low')
    && (value.category === 'bug' || value.category === 'performance' || value.category === 'security'
      || value.category === 'maintainability' || value.category === 'best_practice')
    && typeof value.message === 'string'
    && typeof value.suggestion === 'string'
    && typeof value.file === 'string'
    && typeof value.startLine === 'number'
    && typeof value.endLine === 'number';
}

export function issueFromCommandArgument(value: unknown): ReviewIssue | undefined {
  if (isReviewIssue(value)) {
    return value;
  }
  return isObject(value) && isReviewIssue(value.issue) ? value.issue : undefined;
}

export function suggestionFromCommandArgument(value: unknown): string | undefined {
  const suggestion = issueFromCommandArgument(value)?.suggestion;
  return suggestion?.trim() ? suggestion : undefined;
}
