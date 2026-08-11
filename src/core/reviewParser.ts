import { ResponseError } from './errors';
import { normalizeReviewIssue } from './reviewIssue';
import type { IssueCategory, IssueSeverity, ReviewResult } from './types';

export interface ReviewParseOptions {
  defaultFile?: string;
  maxIssues: number;
}

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function valueText(value: unknown, fallback = ''): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized || fallback;
}

function valueLine(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.trunc(numeric)) : fallback;
}

function severity(value: unknown): IssueSeverity {
  const normalized = valueText(value).toLowerCase();
  return normalized === 'high' || normalized === 'medium' || normalized === 'low' ? normalized : 'medium';
}

function category(value: unknown): IssueCategory {
  const normalized = valueText(value).toLowerCase().replace(/[\s-]+/g, '_');
  return normalized === 'bug' || normalized === 'performance' || normalized === 'security'
    || normalized === 'maintainability' || normalized === 'best_practice'
    ? normalized
    : 'maintainability';
}

function jsonContent(raw: string): string {
  const fenced = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : raw).trim();
}

export function parseReviewResponse(raw: string, options: ReviewParseOptions): ReviewResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonContent(raw));
  } catch {
    throw new ResponseError('Model response was not valid JSON.');
  }
  const result = asRecord(parsed);
  if (!result || !Array.isArray(result.issues) || typeof result.summary !== 'string') {
    throw new ResponseError('Model response must be an object with a summary string and an issues array.');
  }
  if (!Number.isInteger(options.maxIssues) || options.maxIssues < 1) {
    throw new ResponseError('Maximum issues must be a positive integer.');
  }

  const defaultFile = options.defaultFile?.trim() || '(unknown file)';
  const issues = result.issues
    .map(asRecord)
    .filter((issue): issue is JsonRecord => issue !== undefined)
    .slice(0, options.maxIssues)
    .map((issue) => {
      const startLine = valueLine(issue.startLine, 1);
      const endLine = Math.max(startLine, valueLine(issue.endLine, startLine));
      return normalizeReviewIssue({
        title: valueText(issue.title, 'Review finding'),
        severity: severity(issue.severity),
        category: category(issue.category),
        message: valueText(issue.message, 'The model did not provide a detailed message.'),
        suggestion: valueText(issue.suggestion, 'Review this code path and apply an appropriate fix.'),
        file: valueText(issue.file, defaultFile),
        startLine,
        endLine,
      });
    });
  return { summary: result.summary.trim(), issues };
}
