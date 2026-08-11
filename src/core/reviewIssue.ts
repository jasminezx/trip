import { createIssueId } from './issueId';
import type { ReviewIssue, ReviewIssueInput } from './types';

function normalizeLine(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback;
}

export function normalizeReviewIssue(input: ReviewIssueInput): ReviewIssue {
  const file = input.file.trim();
  const message = input.message.trim();
  const title = input.title.trim();
  const suggestion = input.suggestion.trim();
  const startLine = normalizeLine(input.startLine, 1);
  const endLine = Math.max(startLine, normalizeLine(input.endLine, startLine));
  const id = createIssueId({
    filePath: file,
    range: { startLine, startCharacter: 0, endLine, endCharacter: 0 },
    message,
    title,
    suggestion,
  });

  return {
    id,
    title,
    severity: input.severity,
    category: input.category,
    message,
    suggestion,
    file,
    startLine,
    endLine,
  };
}
