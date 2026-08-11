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
  /** Locally collected path for navigation only. Never accepted from model output or prompts. */
  navigationFilePath?: string;
}

export type ReviewIssueInput = Omit<ReviewIssue, 'id'>;

export interface ReviewRequest {
  mode: ReviewMode;
  content: string;
  filePath?: string;
  language?: string;
  /** One-based complete-file line at which selected content begins. */
  selectionStartLine?: number;
  /** Locally collected path retained for navigation only and never included in prompts. */
  navigationFilePath?: string;
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: string;
}

export interface ReviewMetadata {
  mode: ReviewMode;
  reviewedAt: string;
  issueCount: number;
}

export interface ReviewRunResult extends ReviewResult {
  metadata: ReviewMetadata;
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
