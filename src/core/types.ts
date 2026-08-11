export type ReviewMode = 'selection' | 'file' | 'diff';

export type IssueSeverity = 'info' | 'warning' | 'error';

export interface TextPosition {
  line: number;
  character: number;
}

export interface ReviewRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

export interface ReviewIssue {
  id: string;
  filePath: string;
  range: ReviewRange;
  severity: IssueSeverity;
  message: string;
  explanation?: string;
  suggestion?: string;
}

export interface ReviewRequest {
  mode: ReviewMode;
  content: string;
  filePath?: string;
  language?: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary?: string;
}

export interface IssueIdInput {
  filePath: string;
  range: ReviewRange;
  message: string;
}

export interface DocumentBoundary {
  lineCount: number;
  lastLineLength: number;
}
