import * as fs from "fs";

import {
  DecorationOptions,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TextEditor,
  Uri,
  ViewColumn,
  WebviewPanel,
  commands,
  window,
  workspace,
} from "vscode";

import path from "path";

interface CommentType {
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
let activeEditor: TextEditor | undefined;

export async function activate(context: ExtensionContext) {
  activeEditor = window.activeTextEditor;
  const filePath = getFilePath("comments.json");
  if (filePath) {
    showFileComments(filePath, context);
  }

  context.subscriptions.push(
    commands.registerCommand("extension.showCommentSidebar", () => {
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

      fs.readFile(webviewPath, "utf-8", (error, data) => {
        if (error) {
          window.showErrorMessage(`Error reading HTML file: ${error.message}`);
          return;
        }

        panel.webview.html = data.replace("${cssPath}", cssUri.toString());

        panel.webview.onDidReceiveMessage(
          (message) => {
            handleMessageFromWebview(message);
          },
          undefined,
          context.subscriptions
        );
      });
    })
  );

  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor && filePath) {
        activeEditor = editor;
        showFileComments(filePath, context);
      }
    })
  );
}

function handleMessageFromWebview(message: any) {
  switch (message.command) {
    case "getText":
      const filePath = getFilePath("comments.json");
      if (filePath && activeEditor) {
        const fileName = activeEditor.document.fileName;
        const { text: commentText } = message;
        saveToFile(filePath, fileName, activeEditor.selection, commentText);
        deactivate();
      }
  }
}

function getFilePath(fileName: string) {
  if (!activeEditor) {
    // window.showErrorMessage("No file is opened.");
    return;
  }
  const docUri = activeEditor.document.uri;
  const workspaceFolder = workspace.getWorkspaceFolder(docUri);
  if (!workspaceFolder) {
    window.showErrorMessage(
      "No workspace folder found. Choose a project to review."
    );
    return;
  }
  return path.join(workspaceFolder.uri.fsPath, fileName);
}

async function readFromFile(filePath: string): Promise<CommentType[]> {
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
        (comment) => comment.fileName === fileName
      );
    } else {
      return [];
    }
  } catch (error) {
    console.error(`Error getting comments: ${error}`);
    return [];
  }
}

async function showFileComments(filePath: string, context: ExtensionContext) {
  if (!activeEditor) {
    return;
  }

  const fileComments = await getComments(filePath);
  const iconDecoration: DecorationOptions[] = [];
  const highlightDecoration: DecorationOptions[] = [];

  fileComments.forEach((comment: CommentType) => {
    const { start, end } = comment;
    const startPos = new Position(start.line - 1, start.character - 1);
    const endPos = new Position(end.line - 1, end.character - 1);
    const lineLength =
      activeEditor?.document.lineAt(end.line - 1).text.length ??
      end.character - 1; // Get the end of the selected line, otherwise end of selection
    const lineStartPosition = new Position(end.line - 1, 0);
    const lineEndPosition = new Position(end.line - 1, lineLength);

    iconDecoration.push({
      range: new Range(lineStartPosition, lineEndPosition),
    });
    highlightDecoration.push({ range: new Range(startPos, endPos) });
  });

  const icon = window.createTextEditorDecorationType({
    after: {
      contentIconPath: context.asAbsolutePath(path.join("src", "comment.svg")),
      margin: "5px",
    },
  });
  const highlight = window.createTextEditorDecorationType({
    backgroundColor: "#8CBEB260",
  });
  activeEditor.setDecorations(icon, iconDecoration);
  activeEditor.setDecorations(highlight, highlightDecoration);
}

async function saveToFile(
  filePath: string,
  fileName: string,
  selection: Selection,
  commentText: string
) {
  try {
    const newComment: CommentType = {
      fileName,
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

    const existingComments = await readFromFile(filePath);
    existingComments.push(newComment);
    const commentJson = JSON.stringify({ comments: existingComments });
    await fs.promises.writeFile(filePath, commentJson);
  } catch (error) {
    console.error(`Error saving to file: ${error}`);
  }
}

export function deactivate() {
  if (panel) {
    panel.dispose();
    activeEditor = window.visibleTextEditors[0];
  }
}
