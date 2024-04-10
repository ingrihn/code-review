import {
  Event,
  EventEmitter,
  Position,
  Range,
  Selection,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  ViewColumn,
  commands,
  window,
  workspace,
} from "vscode";
import {
  getFilePath,
  getWorkspaceFolderUri,
  readFromFile,
} from "./utils/file-utils";

import { INLINE_COMMENTS_FILE } from "./extension";
import { InlineComment } from "./comment";
import { InlineCommentItem } from "./inline-comment-item";
import { getComment } from "./utils/comment-utils";

export class InlineCommentItemProvider
  implements TreeDataProvider<InlineCommentItem>
{
  private _onDidChangeTreeData: EventEmitter<
    InlineCommentItem | undefined | null | void
  > = new EventEmitter<InlineCommentItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<
    InlineCommentItem | undefined | null | void
  > = this._onDidChangeTreeData.event;

  public constructor() {
    commands.registerCommand("extension.navigateToComment", (item) =>
      this.navigateToComment(item)
    );
  }

  public getTreeItem(element: InlineCommentItem): TreeItem {
    return element;
  }

  public async getChildren(
    element?: InlineCommentItem
  ): Promise<InlineCommentItem[]> {
    const comments: InlineCommentItem[] = [];
    const filePath = getFilePath(INLINE_COMMENTS_FILE);
    const fileData = await readFromFile(filePath);
    const savedComments = fileData.inlineComments;

    if (!element) {
      const addedFileNames: Set<string> = new Set();

      savedComments.forEach((comment: { fileName: string }) => {
        if (!addedFileNames.has(comment.fileName)) {
          const fileNameItem = new InlineCommentItem(
            comment.fileName,
            TreeItemCollapsibleState.Collapsed
          );
          comments.push(fileNameItem);
          addedFileNames.add(comment.fileName);
        }
      });
    } else {
      savedComments.forEach(
        (comment: {
          fileName: string;
          title: string;
          comment: string;
          start: { line: number; character: number };
        }) => {
          if (element.label === comment.fileName) {
            const commentItem = new InlineCommentItem(
              comment.title,
              TreeItemCollapsibleState.None,
              comment.comment,
              comment.fileName,
              comment.start.line,
              comment.start.character
            );

            commentItem.command = {
              command: "extension.navigateToComment",
              title: commentItem.label,
              arguments: [commentItem],
            };
            comments.push(commentItem);
          }
        }
      );
    }
    return Promise.resolve(comments);
  }

  /**
   * Navigates to the comment in its associated file and opens the webview panel for the comment
   * @param {InlineCommentItem} commentItem The inline comment to navigate to.
   */
  private navigateToComment(commentItem: InlineCommentItem) {
    if (
      commentItem.fileName === undefined ||
      commentItem.startLine === undefined ||
      commentItem.startCharacter === undefined
    ) {
      return;
    }
    const fileUri = Uri.joinPath(getWorkspaceFolderUri(), commentItem.fileName);

    workspace.openTextDocument(fileUri).then((document) => {
      const column: ViewColumn = 1;
      window.showTextDocument(document, column).then(async (editor) => {
        let position = new Position(
          commentItem.startLine! - 1,
          commentItem.startCharacter! - 1
        );

        editor.selection = new Selection(position, position);
        let range = new Range(position, position);
        editor.revealRange(range);
        const comment: InlineComment | undefined = await getComment(range);
        commands.executeCommand("extension.showCommentSidebar", comment);
      });
    });
  }

  /**
   * Updates the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
