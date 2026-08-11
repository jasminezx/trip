import * as vscode from 'vscode';
import type { ReviewStore, Disposable as StoreDisposable } from '../app/reviewStore';
import { buildReviewTree, type ReviewTreeNode } from '../app/treeModel';

export class ReviewTreeProvider implements vscode.TreeDataProvider<ReviewTreeNode>, vscode.Disposable {
  private readonly changed = new vscode.EventEmitter<ReviewTreeNode | undefined | void>();
  private readonly storeSubscription: StoreDisposable;

  public readonly onDidChangeTreeData = this.changed.event;

  public constructor(private readonly store: ReviewStore) {
    this.storeSubscription = store.subscribe(() => this.changed.fire());
  }

  public getTreeItem(node: ReviewTreeNode): vscode.TreeItem {
    const collapsibleState = node.kind === 'group'
      ? vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(node.label, collapsibleState);
    item.id = node.id;
    item.description = node.description;
    item.tooltip = node.tooltip;

    if (node.kind === 'issue') {
      item.contextValue = 'reviewPilot.issue';
      item.iconPath = new vscode.ThemeIcon(
        node.severity === 'high' ? 'error' : node.severity === 'medium' ? 'warning' : 'info',
      );
      if (node.command) {
        item.command = { command: node.command.id, title: 'Open Issue', arguments: node.command.arguments };
      }
    } else if (node.kind === 'summary') {
      item.iconPath = new vscode.ThemeIcon('comment-discussion');
    } else if (node.kind === 'group') {
      item.iconPath = new vscode.ThemeIcon('list-tree');
    } else if (node.id === 'loading') {
      item.iconPath = new vscode.ThemeIcon('loading~spin');
    } else if (node.id === 'error') {
      item.iconPath = new vscode.ThemeIcon('error');
    }
    return item;
  }

  public getChildren(node?: ReviewTreeNode): ReviewTreeNode[] {
    return node ? node.children ?? [] : buildReviewTree(this.store.getState());
  }

  public dispose(): void {
    this.storeSubscription.dispose();
    this.changed.dispose();
  }
}
