import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewIssue } from '../core/types';

const fake = vi.hoisted(() => ({
  openedFiles: [] as string[],
  workspaceFolders: [{ uri: { fsPath: 'C:\\repo' } }],
  activeTextEditor: { document: { uri: { scheme: 'file', fsPath: 'C:\\repo\\active.ts' } } },
}));

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() { return fake.activeTextEditor; },
    createTextEditorDecorationType: () => ({ dispose: () => undefined }),
    showTextDocument: async () => { throw new Error('showTextDocument should not run for a rejected path'); },
  },
  workspace: {
    get workspaceFolders() { return fake.workspaceFolders; },
    openTextDocument: async (file: string) => { fake.openedFiles.push(file); throw new Error('unexpected open'); },
  },
  Uri: { file: (file: string) => file },
  ThemeColor: class {},
}));

import { IssueNavigator } from './issueNavigator';

const outsideIssue: ReviewIssue = {
  id: 'outside', title: 'Outside', severity: 'high', category: 'security', message: 'Bad path.',
  suggestion: 'Stay inside.', file: '..\\secret.ts', startLine: 1, endLine: 1,
};

describe('IssueNavigator containment boundary', () => {
  beforeEach(() => { fake.openedFiles.length = 0; });

  it('rejects traversal before asking VS Code to open a document', async () => {
    const navigator = new IssueNavigator();
    await expect(navigator.open(outsideIssue)).rejects.toThrow('This issue points outside the current workspace.');
    expect(fake.openedFiles).toEqual([]);
    navigator.dispose();
  });

  it('rejects a lexically-contained file whose canonical path escapes through a link', async () => {
    const navigator = new IssueNavigator(async (file) => (
      file.toLowerCase() === 'c:\\repo\\linked.ts' ? 'D:\\outside\\secret.ts' : file
    ));
    await expect(navigator.open({ ...outsideIssue, file: 'linked.ts' }))
      .rejects.toThrow('This issue points outside the current workspace.');
    expect(fake.openedFiles).toEqual([]);
    navigator.dispose();
  });
});
