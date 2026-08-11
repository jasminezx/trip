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
  const workspaceRoots = vscode.workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [];
  return {
    documentText: document.getText(),
    selectionText: document.getText(editor.selection),
    filePath: document.uri.scheme === 'file'
      ? document.uri.fsPath
      : document.uri.path.split('/').filter(Boolean).at(-1),
    workspaceRoots,
    language: document.languageId,
    selectionStartLine: editor.selection.start.line + 1,
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
