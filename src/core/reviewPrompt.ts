import type { ReviewRequest } from './types';

export interface ReviewPrompt {
  system: string;
  user: string;
}

const SYSTEM_PROMPT = [
  'You are a precise code reviewer.',
  'Report only concrete, actionable findings that are supported by the supplied code.',
  'Return strict JSON only, with no Markdown or prose outside the JSON object.',
  'The JSON object must have "summary" and "issues" fields.',
  'Each issue must include title, severity, category, message, suggestion, file, startLine, and endLine.',
].join(' ');

function targetDescription(request: ReviewRequest): string {
  switch (request.mode) {
    case 'selection': return 'Review the selected code';
    case 'file': return 'Review the entire file';
    case 'diff': return 'Review the Git diff';
  }
}

export function buildReviewPrompt(request: ReviewRequest, maxIssues: number): ReviewPrompt {
  const file = request.filePath?.trim() || '(no file path available)';
  const language = request.language?.trim() || 'auto';
  return {
    system: SYSTEM_PROMPT,
    user: `${targetDescription(request)}. File: ${file}. Language: ${language}. Maximum issues: ${maxIssues}.\n\nContent:\n${request.content}`,
  };
}
