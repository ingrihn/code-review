import * as fs from "fs";

import {
  DecorationOptions,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TextEditor,
  TextEditorDecorationType,
  TextEditorSelectionChangeEvent,
  Uri,
  ViewColumn,
  WebviewPanel,
  commands,
  window,
  workspace,
} from "vscode";

import path from "path";

interface CommentType {
  id: number;
  fileName: string;
  start: {
    line: number;
    character: number;
  };
  end: {
    line: number;
    character: number;
  };
  comment: string;
}

let panel: WebviewPanel;
let activeEditor: TextEditor;
let iconDecoration: DecorationOptions[] = [];
let highlightDecoration: DecorationOptions[] = [];
let icon: TextEditorDecorationType;
let highlight: TextEditorDecorationType;
const commentsFile: string = "comments.json";

export function activate(context: ExtensionContext) {
  activeEditor = window.activeTextEditor ?? window.visibleTextEditors[0];
  icon = window.createTextEditorDecorationType({
    after: {
      contentIconPath: context.asAbsolutePath(path.join("src", "comment.svg")),
      margin: "5px",
    },
  });
  highlight = window.createTextEditorDecorationType({
    backgroundColor: "#8CBEB260",
  });
  const filePath = getFilePath("comments.json");
  if (filePath) {
    showComments(filePath);
  }

  context.subscriptions.push(
    commands.registerCommand(
      "extension.showCommentSidebar",
      (comment?: CommentType) => {
        // Close panel if there's already one open
        if (panel) {
          panel.dispose();
        }

        panel = window.createWebviewPanel(
          "commentSidebar",
          "Comment Sidebar",
          ViewColumn.Beside,
          {
            enableScripts: true,
          }
        );

        const webviewPath = path.resolve(__dirname, "../src/webview.html");
        const cssPath = Uri.joinPath(context.extensionUri, "src", "custom.css");
        const cssUri = panel.webview.asWebviewUri(cssPath);

        fs.readFile(webviewPath, "utf-8", (err, data) => {
          if (err) {
            window.showErrorMessage(`Error reading HTML file: ${err.message}`);
            return;
          }

          let htmlContent = data.replace("${cssPath}", cssUri.toString());
          let commentText = comment && comment.comment ? comment.comment : "";
          let commentId = comment && comment.id ? comment.id : Date.now();

          htmlContent = htmlContent.replace("${commentText}", commentText);
          htmlContent = htmlContent.replace(
            "${commentId}",
            commentId.toString()
          );
          panel.webview.html = htmlContent;

          panel.webview.onDidReceiveMessage(
            (message) => {
              handleMessageFromWebview(message);
            },
            undefined,
            context.subscriptions
          );
        });
      }
    )
  );

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
      if (editor && filePath) {
        activeEditor = editor;
        showComments(filePath);
      }
    })
  );

  // Click on highlighted text to view comment in webview
  context.subscriptions.push(
    window.onDidChangeTextEditorSelection(
      async (event: TextEditorSelectionChangeEvent) => {
        const selection = event.selections[0];
        // Prevents unwanted behaviour with multi-selection
        if (
          activeEditor &&
          selection.anchor.isEqual(selection.active) &&
          selection.start.line === selection.end.line
        ) {
          const clickedPosition: Position = activeEditor.selection.active;
          let highlightedRange: Range | undefined;
          const isHighlightedClicked = highlightDecoration.some(
            (decoration) => {
              if (decoration.range.contains(clickedPosition)) {
                highlightedRange = decoration.range;
                return true; // Stop iteration once a match is found
              }
              return false;
            }
          );

          if (isHighlightedClicked && highlightedRange) {
            const comment: CommentType | undefined = await getComment(
              highlightedRange
            );
            if (comment) {
              commands.executeCommand("extension.showCommentSidebar", comment);
            }
          }
        }
      }
    )
  );
}

async function getComment(input: Range | number) {
  const filePath = getFilePath("comments.json");
  if (!filePath) {
    return;
  }

  const allComments = await readFromFile(filePath);
  let comment: CommentType | undefined;

  if (input instanceof Range) {
    const range = input;
    comment = allComments.find(
      (c: CommentType) =>
        c.fileName === activeEditor.document.fileName &&
        c.start.line <= range.start.line + 1 &&
        c.end.line >= range.end.line + 1 &&
        c.start.character <= range.start.character + 1 &&
        c.end.character >= range.end.character + 1
    );
  } else if (typeof input === "number") {
    const commentId = input;
    comment = allComments.find((c: CommentType) => c.id === commentId);
  }
  return comment;
}

function handleMessageFromWebview(message: any) {
  switch (message.command) {
    case "addComment":
      const { text: commentText } = message;
      const fileName = activeEditor.document.fileName;
      saveToFile(fileName, activeEditor.selection, commentText);
      deactivate();
    case "deleteComment":
      const { text: commentId } = message;
      deleteComment(commentId);
      deactivate();
    // case "editComment":
    //   console.log("updated", commentText);
    default:
      break; // Handle unknown command
  }
}

async function deleteComment(commentId: number) {
  const jsonFilePath = getFilePath(commentsFile);

  if (!jsonFilePath) {
    window.showErrorMessage("JSON file not found");
    return;
  }

  try {
    const existingComments = await readFromFile(jsonFilePath);
    const commentIndex = existingComments.findIndex(
      (comment: CommentType) => comment.id === commentId
    );
    if (commentIndex !== -1) {
      existingComments.splice(commentIndex, 1);
      const updatedData = { comments: existingComments };
      fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData));
      console.log("deleted", commentId);
    }
  } catch (error) {
    window.showErrorMessage(`Error deleting from file: ${error}`);
    return;
  }
}

function saveToFile(
  fileName: string,
  selection: Selection,
  commentText: string
) {
  const jsonFilePath = getFilePath(commentsFile);

  if (!jsonFilePath) {
    window.showErrorMessage("JSON file not found");
    return;
  }

  try {
    const commentData: CommentType = {
      id: Date.now(),
      fileName: fileName,
      start: {
        line: selection.start.line + 1,
        character: selection.start.character + 1,
      },
      end: {
        line: selection.end.line + 1,
        character: selection.end.character + 1,
      },
      comment: commentText,
    };

    const dataFromFile = JSON.parse(fs.readFileSync(jsonFilePath, "utf-8"));
    dataFromFile.comments.push(commentData);
    const commentJson = JSON.stringify(dataFromFile);
    fs.writeFileSync(jsonFilePath, commentJson);
  } catch (error) {
    window.showErrorMessage(`Error saving to file: ${error}`);
    return;
  }
}

async function readFromFile(filePath: string) {
  try {
    const jsonData = await fs.promises.readFile(filePath, "utf-8");
    const { comments } = JSON.parse(jsonData);
    return comments;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.promises.writeFile(filePath, '{"comments": []}');
      return [];
    } else {
      console.error(error);
      return [];
    }
  }
}

async function getComments(filePath: string): Promise<CommentType[]> {
  try {
    if (activeEditor) {
      const fileName = activeEditor.document.fileName;
      const existingComments = await readFromFile(filePath);
      return existingComments.filter(
        (comment: CommentType) => comment.fileName === fileName
      );
    } else {
      return [];
    }
  } catch (error) {
    console.error(`Error getting comments: ${error}`);
    return [];
  }
}

async function showComments(filePath: string) {
  // Empty arrays to avoid duplicate decoration when adding a new comment
  iconDecoration = [];
  highlightDecoration = [];

  const fileComments = await getComments(filePath);
  fileComments.forEach((comment: CommentType) => {
    const { start, end } = comment;
    const startPos = new Position(start.line - 1, start.character - 1);
    const endPos = new Position(end.line - 1, end.character - 1);
    const lineLength = activeEditor.document.lineAt(end.line - 1).text.length;
    const lineStartPosition = new Position(end.line - 1, 0);
    const lineEndPosition = new Position(end.line - 1, lineLength);
    iconDecoration.push({
      range: new Range(lineStartPosition, lineEndPosition),
    });
    highlightDecoration.push({ range: new Range(startPos, endPos) });
  });

  activeEditor.setDecorations(icon, iconDecoration);
  activeEditor.setDecorations(highlight, highlightDecoration);
}

function getFilePath(fileName: string) {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    window.showErrorMessage("Workspace folders not found.");
    return;
  }
  const workspaceFolder = workspaceFolders[0];
  if (!workspaceFolder) {
    window.showErrorMessage("Workspace folder not found.");
  }
  return path.join(workspaceFolder.uri.fsPath, fileName);
}

export function deactivate() {
  if (panel) {
    panel.dispose();
  }
}
