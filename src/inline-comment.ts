import { TreeItem, TreeItemCollapsibleState } from "vscode";

export class InlineComment extends TreeItem {
    constructor(
      public readonly label: string,
      public readonly collapsibleState: TreeItemCollapsibleState,
      public readonly comment?: string,
      public readonly fileName?: string,
      public readonly startLine?: number,
      public readonly startCharacter?: number
    ) {
      super(label, collapsibleState);
      this.description = comment;
    }
  }