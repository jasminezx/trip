import { ResponseError } from './errors';
import { normalizeReviewIssue } from './reviewIssue';
import type { IssueCategory, IssueSeverity, ReviewMode, ReviewResult } from './types';

export interface ReviewParseOptions {
  defaultFile?: string;
  maxIssues: number;
  mode?: ReviewMode;
  lineOffset?: number;
  diffFilePaths?: ReadonlyArray<string> | ReadonlySet<string>;
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

function normalizeFile(value: string): string {
  let normalized = value.replace(/\\/g, '/').replace(/^"|"$/g, '').trim();
  if (normalized.startsWith('./')) {
    normalized = normalized.slice(2);
  }
  return normalized;
}

function jsonContent(raw: string): string {
  const fenced = raw.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\s*```$/i);
  return (fenced ? fenced[1] : raw).trim();
}

function asDiffPathSet(paths?: ReviewParseOptions['diffFilePaths']): Set<string> | undefined {
  if (!paths || (Array.isArray(paths) && paths.length === 0)) {
    return undefined;
  }
  const normalizedPaths = new Set<string>();
  const values = paths instanceof Set ? [...paths] : paths;
  for (const value of values) {
    const normalized = value.trim().replace(/\\/g, '/');
    if (normalized) {
      normalizedPaths.add(normalized);
    }
  }
  return normalizedPaths.size ? normalizedPaths : undefined;
}

function stripDiffPrefix(value: string): string {
  return value.slice(2);
}

function normalizeFileForMode(
  value: string,
  mode: ReviewMode | undefined,
  diffFilePaths: Set<string> | undefined,
): string {
  const normalized = normalizeFile(value);
  if (mode !== 'diff') {
    return normalized;
  }

  if (!normalized.startsWith('a/') && !normalized.startsWith('b/')) {
    return normalized;
  }

  if (!diffFilePaths || diffFilePaths.size === 0) {
    return normalized;
  }

  const withoutPrefix = stripDiffPrefix(normalized);
  return diffFilePaths.has(withoutPrefix) ? withoutPrefix : normalized;
}

function uniqueIssues<T extends { id: string }>(issues: T[]): T[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = JSON.stringify(issue);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function parseReviewResponse(raw: string, options: ReviewParseOptions): ReviewResult {
  const diffFilePaths = asDiffPathSet(options.diffFilePaths);
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

  const defaultFile = normalizeFile(options.defaultFile?.trim() || '(unknown file)');
  const lineOffset = Number.isInteger(options.lineOffset) ? Math.max(0, options.lineOffset ?? 0) : 0;
  const normalizedIssues = result.issues
    .map(asRecord)
    .filter((issue): issue is JsonRecord => issue !== undefined)
    .map((issue) => {
      const relativeStartLine = valueLine(issue.startLine, 1);
      const relativeEndLine = Math.max(relativeStartLine, valueLine(issue.endLine, relativeStartLine));
      return normalizeReviewIssue({
        title: valueText(issue.title, 'Review finding'),
        severity: severity(issue.severity),
        category: category(issue.category),
        message: valueText(issue.message, 'The model did not provide a detailed message.'),
        suggestion: valueText(issue.suggestion, 'Review this code path and apply an appropriate fix.'),
        file: normalizeFileForMode(valueText(issue.file, defaultFile), options.mode, diffFilePaths),
        startLine: relativeStartLine + lineOffset,
        endLine: relativeEndLine + lineOffset,
      });
    });
  const issues = uniqueIssues(normalizedIssues).slice(0, options.maxIssues);
  return { summary: result.summary.trim(), issues };
}
