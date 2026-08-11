import * as vscode from 'vscode';
import { issueLineRange, resolveIssueFile } from '../app/issueLocation';
import type { ReviewIssue } from '../core/types';

const HIGHLIGHT_DURATION_MS = 2_000;

export class IssueNavigator implements vscode.Disposable {
  private readonly highlight = vscode.window.createTextEditorDecorationType({
    backgroundColor: new vscode.ThemeColor('editor.findMatchHighlightBackground'),
    isWholeLine: true,
  });
  private clearHighlightTimer: ReturnType<typeof setTimeout> | undefined;
  private highlightedEditor: vscode.TextEditor | undefined;

  public async open(issue: ReviewIssue): Promise<void> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const activeFile = vscode.window.activeTextEditor?.document.uri.scheme === 'file'
      ? vscode.window.activeTextEditor.document.uri.fsPath
      : undefined;
    const file = resolveIssueFile(issue.file, workspaceRoot, activeFile);
    if (!file) {
      throw new Error('This issue does not include a file location.');
    }

    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
    const editor = await vscode.window.showTextDocument(document);
    const lines = issueLineRange(issue);
    const startLine = Math.min(lines.startLine, Math.max(0, document.lineCount - 1));
    const endLine = Math.min(lines.endLine, Math.max(0, document.lineCount - 1));
    const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
    this.highlightedEditor?.setDecorations(this.highlight, []);
    editor.setDecorations(this.highlight, [range]);
    this.highlightedEditor = editor;
    if (this.clearHighlightTimer) {
      clearTimeout(this.clearHighlightTimer);
    }
    this.clearHighlightTimer = setTimeout(() => {
      editor.setDecorations(this.highlight, []);
      if (this.highlightedEditor === editor) {
        this.highlightedEditor = undefined;
      }
    }, HIGHLIGHT_DURATION_MS);
  }

  public dispose(): void {
    if (this.clearHighlightTimer) {
      clearTimeout(this.clearHighlightTimer);
    }
    this.highlightedEditor?.setDecorations(this.highlight, []);
    this.highlight.dispose();
  }
}
