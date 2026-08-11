export type ReviewMode = 'selection' | 'file' | 'diff';

export type IssueSeverity = 'high' | 'medium' | 'low';

export type IssueCategory =
  | 'bug'
  | 'performance'
  | 'security'
  | 'maintainability'
  | 'best_practice';

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
  title: string;
  severity: IssueSeverity;
  category: IssueCategory;
  message: string;
  suggestion: string;
  file: string;
  startLine: number;
  endLine: number;
}

export type ReviewIssueInput = Omit<ReviewIssue, 'id'>;

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
