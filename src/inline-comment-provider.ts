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
  commands,
  window,
  workspace,
} from "vscode";
import {
  getComment,
  getFilePath,
  getWorkspaceFolderUri,
  readFromFile,
} from "./extension";

import { CommentType } from "./comment-type";
import { InlineComment } from "./inline-comment";

export class InlineCommentProvider implements TreeDataProvider<InlineComment> {
  private _onDidChangeTreeData: EventEmitter<
    InlineComment | undefined | null | void
  > = new EventEmitter<InlineComment | undefined | null | void>();
  readonly onDidChangeTreeData: Event<InlineComment | undefined | null | void> =
    this._onDidChangeTreeData.event;

  public constructor() {
    commands.registerCommand("extension.navigateToComment", (item) =>
      this.navigateToComment(item)
    );
  }

  getTreeItem(element: InlineComment): TreeItem {
    return element;
  }

  async getChildren(element?: InlineComment): Promise<InlineComment[]> {
    const comments: InlineComment[] = [];
    const filePath = getFilePath("comments.json");
    const savedComments = await readFromFile(filePath);

    if (!element) {
      const addedFileNames: Set<string> = new Set();

      savedComments.forEach((comment: { fileName: string }) => {
        if (!addedFileNames.has(comment.fileName)) {
          const fileNameItem = new InlineComment(
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
            const commentItem = new InlineComment(
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

  navigateToComment(commentItem: InlineComment) {
    if (
      commentItem.fileName === undefined ||
      commentItem.startLine === undefined ||
      commentItem.startCharacter === undefined
    ) {
      return;
    }
    const fileUri = Uri.joinPath(getWorkspaceFolderUri(), commentItem.fileName);
    workspace.openTextDocument(fileUri).then((document) => {
      window.showTextDocument(document).then(async (editor) => {
        let position = new Position(
          commentItem.startLine! - 1,
          commentItem.startCharacter! - 1
        );
        editor.selection = new Selection(position, position);
        let range = new Range(position, position);
        editor.revealRange(range);
        const comment: CommentType | undefined = await getComment(range);
        commands.executeCommand("extension.showCommentSidebar", comment);
      });
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
