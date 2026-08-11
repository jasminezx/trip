import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReviewIssue } from '../core/types';

const fake = vi.hoisted(() => ({
  openedFiles: [] as string[],
  workspaceFolders: [{ uri: { fsPath: 'C:\\repo' } }],
  activeTextEditor: { document: { uri: { scheme: 'file', fsPath: 'C:\\repo\\active.ts' } } },
  shownEditor: {
    selection: undefined as unknown,
    revealRange: () => undefined,
    setDecorations: () => undefined,
  },
}));

vi.mock('vscode', () => ({
  window: {
    get activeTextEditor() { return fake.activeTextEditor; },
    createTextEditorDecorationType: () => ({ dispose: () => undefined }),
    showTextDocument: async () => fake.shownEditor,
  },
  workspace: {
    get workspaceFolders() { return fake.workspaceFolders; },
    openTextDocument: async (file: string) => {
      fake.openedFiles.push(file);
      return { lineCount: 20, lineAt: () => ({ text: 'line' }) };
    },
  },
  Uri: { file: (file: string) => file },
  ThemeColor: class {},
  Range: class {
    public readonly start: unknown;
    public readonly end: unknown;
    public constructor(startLine: number, startCharacter: number, endLine: number, endCharacter: number) {
      this.start = { line: startLine, character: startCharacter };
      this.end = { line: endLine, character: endCharacter };
    }
  },
  Selection: class {
    public constructor(public readonly start: unknown, public readonly end: unknown) {}
  },
  TextEditorRevealType: { InCenterIfOutsideViewport: 0 },
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

  it('uses locally trusted navigation metadata without putting an absolute path in the model-facing file value', async () => {
    const navigator = new IssueNavigator(async (file) => file);
    await navigator.open({
      ...outsideIssue,
      file: 'answer.ts',
      navigationFilePath: 'D:\\scratch\\answer.ts',
      startLine: 3,
      endLine: 3,
    });

    expect(fake.openedFiles).toEqual(['D:\\scratch\\answer.ts']);
    navigator.dispose();
  });
});
