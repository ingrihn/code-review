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
import {
  highPriorityIconUri,
  lowPriorityIconUri,
  mediumPriorityIconUri,
} from "./assets/icon-uris";

import { INLINE_COMMENTS_FILE } from "./extension";
import { InlineComment } from "./comment";
import { InlineCommentItem } from "./inline-comment-item";
import { getInlineComment } from "./utils/comment-utils";

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
    commands.registerCommand("reviewify.navigateToComment", (item) =>
      this.navigateToComment(item)
    );
  }

  public getTreeItem(element: InlineCommentItem): TreeItem {
    return element;
  }

  /**
   * Retrieves the child elements for a given element in the tree view.
   * If no element is provided, returns the root elements (file names).
   * @param {InlineCommentItem} element - The parent element for which to get the children. If undefined, gets root elements.
   * @returns {Promise<InlineCommentItem[]>} - A promise that resolves to an array of child elements.
   */
  public async getChildren(
    element?: InlineCommentItem
  ): Promise<InlineCommentItem[]> {
    const comments: InlineCommentItem[] = [];
    const filePath = getFilePath(INLINE_COMMENTS_FILE);
    const fileData = await readFromFile(filePath);
    const savedComments = fileData.inlineComments;

    // Sorts comments in descending priority
    savedComments.sort(
      (a: { priority: number }, b: { priority: number }) =>
        (b.priority || 0) - (a.priority || 0)
    );

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
          priority?: number;
        }) => {
          if (element.label === comment.fileName) {
            const commentItem = new InlineCommentItem(
              comment.title.toString(),
              TreeItemCollapsibleState.None,
              comment.comment.toString(),
              comment.fileName,
              comment.start.line,
              comment.start.character
            );

            switch (comment.priority) {
              case 3:
                commentItem.iconPath = highPriorityIconUri;

                break;
              case 2:
                commentItem.iconPath = mediumPriorityIconUri;
                break;
              case 1:
                commentItem.iconPath = lowPriorityIconUri;
                break;
              default:
                break;
            }

            commentItem.command = {
              command: "reviewify.navigateToComment",
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
   * Navigates to the inline comment in its associated file and opens the webview panel for the comment.
   * @param {InlineCommentItem} commentItem - The inline comment to navigate to.
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
        const comment: InlineComment | undefined = await getInlineComment(range);

        commands.executeCommand("reviewify.showCommentSidebar", comment);
      });
    });
  }

  /**
   * Updates the tree view
   */
  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Retrieves the first element in the tree view, if it exists.
   * @returns {Promise<InlineCommentItem | undefined>} - A promise that resolves to the first InlineCommentItem if it exists, otherwise undefined.
   */
  public getFirstElement(): Promise<InlineCommentItem | undefined> {
    return new Promise((resolve) => {
      this.getChildren().then((children) => {
        if (children.length > 0) {
          resolve(children[0]);
        } else {
          resolve(undefined);
        }
      });
    });
  }

  /**
   * Retrieves the parent of the given element in the tree view.
   * @param {InlineCommentItem} element - The element for which to get the parent.
   * @returns {Thenable<InlineCommentItem | undefined>} - A promise that resolves to undefined.
   */
  public getParent(
    element: InlineCommentItem
  ): Thenable<InlineCommentItem | undefined> {
    return Promise.resolve(undefined); // Return undefined since there are no hierarchical relationships
  }
}
