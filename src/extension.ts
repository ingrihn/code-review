import * as fs from "fs";

import {
  DecorationOptions,
  ExtensionContext,
  Position,
  Range,
  Selection,
  TextEditor,
  TextEditorDecorationType,
  Uri,
  ViewColumn,
  WebviewPanel,
  commands,
  window,
  workspace,
} from "vscode";

import path from "path";
import readline from "readline";

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
let activeEditor: TextEditor;
let iconDecoration: DecorationOptions[] = [];
let highlightDecoration: DecorationOptions[] = [];
let icon: TextEditorDecorationType;
let highlight: TextEditorDecorationType;
let comments: CommentType[] = [];

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
  getComments();

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

      fs.readFile(webviewPath, "utf-8", (err, data) => {
        if (err) {
          window.showErrorMessage(`Error reading HTML file: ${err.message}`);
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
    window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
      if (editor) {
        activeEditor = editor;
        getComments();
      }
    })
  );
}

function handleMessageFromWebview(message: any) {
  switch (message.command) {
    case "getText":
      const { text: commentText } = message;
      const fileName = activeEditor.document.fileName;
      saveToFile(fileName, activeEditor.selection, commentText);
      deactivate();
  }
}

function saveToFile(
  fileName: string,
  selection: Selection,
  commentText: string
) {
  const jsonFilePath = getFilePath();

  if (!jsonFilePath) {
    window.showErrorMessage("JSON file not found");
    return;
  }

  try {
    const commentData: CommentType = {
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

async function readFromFile() {
  const jsonFilePath = getFilePath();

  if (!jsonFilePath) {
    window.showErrorMessage("File not found");
    return;
  }

  try {
    const jsonData = await fs.promises.readFile(jsonFilePath, "utf-8");
    const commentsFromJson = JSON.parse(jsonData).comments;
    commentsFromJson.forEach((comment: CommentType) => comments.push(comment));
  } catch (error: any) {
    if (error.code === "ENOENT") {
      fs.writeFileSync(jsonFilePath, '{"comments": []}'); // Makes new file if it doesnt exist
    } else {
      console.error(error);
    }
  }
}

async function getComments() {
  comments = [];
  iconDecoration = [];
  highlightDecoration = [];
  activeEditor.setDecorations(icon, []);
  activeEditor.setDecorations(highlight, []);

  await readFromFile(); // Adds comments from JSON to array

  const fileName: string = activeEditor.document.fileName;
  const fileComments = comments.filter(
    (comment) => comment.fileName === fileName
  );

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

function getFilePath() {
  const fileName = "comments.json";
  const docUri = activeEditor.document.uri;
  const workspaceFolder = workspace.getWorkspaceFolder(docUri);
  if (!workspaceFolder) {
    window.showErrorMessage("No workspace folder found.");
    return;
  }
  return path.join(workspaceFolder.uri.fsPath, fileName);
}

export function deactivate() {
  if (panel) {
    panel.dispose();
    activeEditor = window.visibleTextEditors[0];
  }
}
