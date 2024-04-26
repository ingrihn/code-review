import { TreeItem, TreeItemCollapsibleState } from "vscode";

export class InlineCommentItem extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly comment?: string,
    public readonly fileName?: string,
    public readonly startLine?: number,
    public readonly startCharacter?: number,
    public readonly priority?: number
  ) {
    super(label, collapsibleState);
    this.description = comment;
  }
}
