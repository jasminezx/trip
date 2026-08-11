import * as vscode from 'vscode';
import { ReviewController } from './app/reviewController';
import { ReviewStore } from './app/reviewStore';
import { validateAiConfiguration, type AiConfiguration } from './core/aiConfig';
import { ChatCompletionsClient } from './core/chatCompletionsClient';
import {
  DEFAULT_BASE_URL, DEFAULT_LANGUAGE, DEFAULT_MAX_ISSUES, DEFAULT_MODEL, DEFAULT_TIMEOUT_MS, RESULTS_VIEW_ID,
} from './core/constants';
import { ReviewService } from './core/reviewService';
import type { ReviewIssue, ReviewMode, ReviewRequest, ReviewRunResult } from './core/types';
import { collectReviewRequest } from './vscode/contextCollector';
import { IssueNavigator } from './vscode/issueNavigator';
import { ReviewTreeProvider } from './vscode/reviewTreeProvider';

function readConfiguration(): AiConfiguration {
  const configuration = vscode.workspace.getConfiguration('reviewPilot');
  return validateAiConfiguration({
    apiKey: configuration.get<string>('apiKey', ''),
    baseUrl: configuration.get<string>('baseUrl', DEFAULT_BASE_URL),
    model: configuration.get<string>('model', DEFAULT_MODEL),
    language: configuration.get<string>('language', DEFAULT_LANGUAGE),
    maxIssues: configuration.get<number>('maxIssues', DEFAULT_MAX_ISSUES),
    timeoutMs: configuration.get<number>('timeoutMs', DEFAULT_TIMEOUT_MS),
  });
}

async function executeReview(request: ReviewRequest): Promise<ReviewRunResult> {
  const configuration = readConfiguration();
  const localizedRequest = {
    ...request,
    language: configuration.language === 'auto' ? request.language ?? 'auto' : configuration.language,
  };
  const service = new ReviewService(new ChatCompletionsClient(configuration));
  return service.review(localizedRequest, { maxIssues: configuration.maxIssues });
}

function registerCommand(
  context: vscode.ExtensionContext,
  command: string,
  callback: (...args: unknown[]) => unknown,
): void {
  context.subscriptions.push(vscode.commands.registerCommand(command, callback));
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Review Pilot');
  const store = new ReviewStore();
  const treeProvider = new ReviewTreeProvider(store);
  const navigator = new IssueNavigator();

  context.subscriptions.push(
    output,
    treeProvider,
    navigator,
    vscode.window.registerTreeDataProvider(RESULTS_VIEW_ID, treeProvider),
  );

  const controller = new ReviewController({
    collect: collectReviewRequest,
    review: executeReview,
    store,
    reportBusy: (message) => { void vscode.window.showInformationMessage(message); },
    reportError: (message) => { void vscode.window.showErrorMessage(message); },
    offerConfiguration: () => { void vscode.commands.executeCommand('workbench.action.openSettings', 'reviewPilot'); },
    log: (message) => output.appendLine(`[${new Date().toISOString()}] ${message}`),
  });

  const review = (mode: ReviewMode) => () => controller.run(mode);
  registerCommand(context, 'reviewPilot.reviewSelectedCode', review('selection'));
  registerCommand(context, 'reviewPilot.reviewCurrentFile', review('file'));
  registerCommand(context, 'reviewPilot.reviewGitDiff', review('diff'));
  registerCommand(context, 'reviewPilot.refreshResults', () => controller.refresh());
  registerCommand(context, 'reviewPilot.openIssue', async (value: unknown) => {
    const issue = value as ReviewIssue | undefined;
    if (!issue?.id) {
      void vscode.window.showErrorMessage('Select a review issue to open.');
      return;
    }
    try {
      await navigator.open(issue);
    } catch (error) {
      void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
    }
  });
  registerCommand(context, 'reviewPilot.copySuggestion', async (value: unknown) => {
    const issue = value as ReviewIssue | undefined;
    if (!issue?.suggestion.trim()) {
      void vscode.window.showInformationMessage('This issue does not include a suggestion.');
      return;
    }
    await vscode.env.clipboard.writeText(issue.suggestion);
    void vscode.window.showInformationMessage('Review suggestion copied.');
  });
  registerCommand(context, 'reviewPilot.openSettings', () => (
    vscode.commands.executeCommand('workbench.action.openSettings', 'reviewPilot')
  ));
}

export function deactivate(): void {
  // VS Code disposes the extension context subscriptions registered by activate.
}
