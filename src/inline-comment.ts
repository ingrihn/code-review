import { TreeItem, TreeItemCollapsibleState } from "vscode";

export class InlineComment extends TreeItem {
    constructor(
      public readonly label: string,
      private comment: string,
      public readonly collapsibleState: TreeItemCollapsibleState
    ) {
      super(label, collapsibleState);
      this.description = comment;
    }
  }