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

import { CommentType } from "./comment-type";
import { GeneralViewProvider } from "./general-view-provider";
import { InlineCommentProvider } from "./inline-comment-provider";
import path from "path";

let panel: WebviewPanel;
let activeEditor: TextEditor;
let treeDataProvider: InlineCommentProvider;
let generalViewProvider: GeneralViewProvider;
let iconDecoration: DecorationOptions[] = [];
let highlightDecoration: DecorationOptions[] = [];
let icon: TextEditorDecorationType;
let highlight: TextEditorDecorationType;
const commentsFile: string = "comments.json";

export async function activate(context: ExtensionContext) {
  treeDataProvider = new InlineCommentProvider();
  const viewId = "collabrate-inline";
  generalViewProvider = new GeneralViewProvider(context.extensionUri);
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
    window.registerWebviewViewProvider(GeneralViewProvider.viewType, {
      resolveWebviewView: async (webviewView, _context, _token) => {
        const webview = await generalViewProvider.resolveWebviewView(
          webviewView,
          _context,
          _token
        );
        const disposable = webviewView.onDidChangeVisibility(async (e) => {
          try {
            await generalViewProvider.resolveWebviewView(
              webviewView,
              _context,
              _token
            );
          } catch (error) {
            console.error("Error fetching rubrics JSON:", error);
          }
        });
        context.subscriptions.push(disposable);
        return webview;
      },
    })
  );
  window.registerTreeDataProvider(viewId, treeDataProvider);

  context.subscriptions.push(
    commands.registerCommand(
      "extension.showCommentSidebar",
      (comment?: CommentType) => {
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
        const cssPath = Uri.joinPath(context.extensionUri, "src", "style.css");
        const cssUri = panel.webview.asWebviewUri(cssPath);

        fs.readFile(webviewPath, "utf-8", (err, data) => {
          if (err) {
            window.showErrorMessage(`Error reading HTML file: ${err.message}`);
            return;
          }

          // Get values from clicked comment if editing existing comment
          let commentText = comment && comment.comment ? comment.comment : "";
          let title = comment && comment.title ? comment.title : "";
          let commentId = comment && comment.id ? comment.id : "";

          let htmlContent = data.replace("${cssPath}", cssUri.toString());
          htmlContent = htmlContent
            .replace("${commentText}", commentText)
            .replace("${commentId}", commentId.toString())
            .replace("${commentTitle}", title);
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

export async function getComment(input: Range | number) {
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
      const commentText = message.data.text;
      const fileName = activeEditor.document.fileName;
      const title = message.data.title;
      saveToFile(fileName, activeEditor.selection, title, commentText);
      deactivate();
      break;
    case "deleteComment":
      const { id: commentId } = message;
      deleteComment(commentId);
      deactivate();
      break;
    case "updateComment":
      const newCommentId = message.data.id;
      const newTitle = message.data.title;
      const newCommentText = message.data.text;
      updateComment(newCommentId, newCommentText, newTitle);
      deactivate();
      break;
    default:
      deactivate();
      break; // Handle unknown command
  }
}

async function updateComment(id: number, comment: string, title: string) {
  const jsonFilePath = getFilePath(commentsFile);

  if (!jsonFilePath) {
    window.showErrorMessage("JSON file not found");
    return;
  }

  try {
    const existingComments = await readFromFile(jsonFilePath);
    const commentIndex = existingComments.findIndex(
      (comment: CommentType) => comment.id === id
    );
    if (commentIndex !== -1) {
      existingComments[commentIndex].comment = comment;
      existingComments[commentIndex].title = title;
      const updatedData = { comments: existingComments };
      fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData));
    }
  } catch (error) {
    window.showErrorMessage(`Error updating file: ${error}`);
    return;
  }
}

async function deleteComment(id: number) {
  const jsonFilePath = getFilePath(commentsFile);

  if (!jsonFilePath) {
    window.showErrorMessage("JSON file not found");
    return;
  }

  try {
    const existingComments = await readFromFile(jsonFilePath);
    const commentIndex = existingComments.findIndex(
      (comment: CommentType) => comment.id === id
    );
    if (commentIndex !== -1) {
      existingComments.splice(commentIndex, 1);
      const updatedData = { comments: existingComments };
      fs.writeFileSync(jsonFilePath, JSON.stringify(updatedData));
    }
  } catch (error) {
    window.showErrorMessage(`Error deleting from file: ${error}`);
    return;
  }
}

function saveToFile(
  fileName: string,
  selection: Selection,
  title: string,
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
      title: title,
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
  treeDataProvider.refresh();
}

export async function readFromFile(filePath: string) {
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

export function getFilePath(fileName: string) {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    window.showErrorMessage("No workspace folders found.");
    return "";
  }
  const workspaceFolder = workspaceFolders[0];
  if (!workspaceFolder) {
    window.showErrorMessage("No workspace folder found.");
  }
  return path.join(workspaceFolder.uri.fsPath, fileName);
}

export async function getRubricsJson(filePath: string) {
  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.promises.writeFile(filePath, '{"rubrics": []}');
      return [];
    } else {
      console.error(error);
      return [];
    }
  }
}

export function deactivate() {
  if (panel) {
    panel.dispose();
  }
}
