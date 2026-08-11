import * as vscode from 'vscode';
import { collectFileRequest, collectGitDiffRequest, collectSelectionRequest, type EditorContext } from '../app/reviewContext';
import { runProcess } from '../app/processRunner';
import type { ReviewMode, ReviewRequest } from '../core/types';

function activeEditorContext(): EditorContext | undefined {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return undefined;
  }
  const document = editor.document;
  return {
    documentText: document.getText(),
    selectionText: document.getText(editor.selection),
    filePath: document.uri.scheme === 'file' ? document.uri.fsPath : document.uri.toString(),
    language: document.languageId,
  };
}

export async function collectReviewRequest(mode: ReviewMode): Promise<ReviewRequest> {
  if (mode === 'selection') {
    return collectSelectionRequest(activeEditorContext());
  }
  if (mode === 'file') {
    return collectFileRequest(activeEditorContext());
  }
  return collectGitDiffRequest(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath, runProcess);
}
