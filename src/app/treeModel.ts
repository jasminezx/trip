import type { IssueSeverity, ReviewIssue } from '../core/types';
import type { ReviewState } from './reviewStore';

export interface TreeCommandModel {
  id: 'reviewPilot.openIssue';
  arguments: [ReviewIssue];
}

export interface ReviewTreeNode {
  id: string;
  label: string;
  description?: string;
  tooltip?: string;
  kind: 'message' | 'summary' | 'group' | 'issue';
  severity?: IssueSeverity;
  issue?: ReviewIssue;
  command?: TreeCommandModel;
  children?: ReviewTreeNode[];
}

const severityLabels: Record<IssueSeverity, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function targetLabel(target: 'selection' | 'file' | 'diff'): string {
  return target === 'selection' ? 'selection' : target === 'file' ? 'current file' : 'Git diff';
}

function lineLabel(issue: ReviewIssue): string {
  return issue.startLine === issue.endLine
    ? `${issue.startLine}`
    : `${issue.startLine}–${issue.endLine}`;
}

function issueNode(issue: ReviewIssue): ReviewTreeNode {
  const location = issue.file ? `${issue.file}:${lineLabel(issue)}` : `line ${lineLabel(issue)}`;
  const suggestion = issue.suggestion ? `\n\nSuggestion: ${issue.suggestion}` : '';
  return {
    id: `issue-${issue.id}`,
    label: issue.title,
    description: `${issue.category.replace(/_/g, ' ')} • ${location}`,
    tooltip: `${issue.message}${suggestion}`,
    kind: 'issue',
    severity: issue.severity,
    issue,
    command: { id: 'reviewPilot.openIssue', arguments: [issue] },
  };
}

function resultNodes(state: Extract<ReviewState, { status: 'success' | 'empty' }>): ReviewTreeNode[] {
  const nodes: ReviewTreeNode[] = [{
    id: 'summary', label: 'Summary', description: state.result.summary, tooltip: state.result.summary, kind: 'summary',
  }];
  if (state.status === 'empty') {
    nodes.push({ id: 'empty', label: 'No issues found.', kind: 'message' });
    return nodes;
  }
  for (const severity of ['high', 'medium', 'low'] as const) {
    const children = state.result.issues.filter((issue) => issue.severity === severity).map(issueNode);
    nodes.push({
      id: `severity-${severity}`,
      label: `${severityLabels[severity]} (${children.length})`,
      kind: 'group',
      severity,
      children,
    });
  }
  return nodes;
}

export function buildReviewTree(state: ReviewState): ReviewTreeNode[] {
  switch (state.status) {
    case 'idle':
      return [{ id: 'idle', label: 'Run a review to see results.', kind: 'message' }];
    case 'loading':
      return [{ id: 'loading', label: `Reviewing ${targetLabel(state.target)}…`, kind: 'message' }];
    case 'error':
      return [{ id: 'error', label: 'Review failed', description: state.message, tooltip: state.message, kind: 'message' }];
    case 'empty':
    case 'success':
      return resultNodes(state);
  }
}
