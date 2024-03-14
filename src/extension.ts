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
  lineStart: number;
  lineEnd: number;
  characterStart: number;
  characterEnd: number;
  comment: string;
}

let panel: WebviewPanel;
let activeEditor: TextEditor;
let iconDecoration: DecorationOptions[];
let highlightDecoration: DecorationOptions[];
let icon: TextEditorDecorationType;
let highlight: TextEditorDecorationType;
let ctx: ExtensionContext;
const header: string = "file,lines,characters,comment\n";
let comments: CommentType[];

export function activate(context: ExtensionContext) {
  ctx = context;
  iconDecoration = [];
  activeEditor = window.activeTextEditor ?? window.visibleTextEditors[0];
  comments = [];
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
      saveInCSV(fileName, activeEditor.selection, commentText);
      deactivate();
  }
}

function getCSVFilePath() {
  const docUri = activeEditor.document.uri;
  const workspaceFolder = workspace.getWorkspaceFolder(docUri);
  if (!workspaceFolder) {
    window.showErrorMessage("No workspace folder found.");
    return;
  }
  return path.join(workspaceFolder.uri.fsPath, "comments.csv");
}

function saveInCSV(fileName: string, selection: Selection, comment: string) {
  const csvFilePath = getCSVFilePath();

  if (!csvFilePath) {
    window.showErrorMessage("CSV file not found");
    return;
  }

  try {
    // Make CSV if it doesn't exist
    if (!fs.existsSync(csvFilePath)) {
      fs.writeFileSync(csvFilePath, header);
    }

    const { start, end } = selection;
    const lines = `${start.line + 1}-${end.line + 1}`;
    const characters = `${start.character + 1}-${end.character + 1}`;
    const csvEntry = `${fileName},${lines},${characters},${comment}\n`;
    fs.appendFileSync(csvFilePath, csvEntry);
  } catch (error) {
    window.showErrorMessage(`Error saving to CSV file: ${error}`);
    return;
  }
}

function readFromCSV() {
  const docUri = activeEditor.document.uri;
  const workspaceFolder = workspace.getWorkspaceFolder(docUri);
  if (!workspaceFolder) {
    window.showErrorMessage("No workspace folder found.");
    return;
  }
  const csvFolderPath = workspaceFolder.uri.fsPath;
  const csvFilePath = path.join(csvFolderPath, "comments.csv");

  if (!fs.existsSync(csvFilePath)) {
    console.error("CSV file does not exist.");
    return Promise.resolve();
  }

  const stream = fs.createReadStream(csvFilePath, {
    encoding: "utf8",
    start: header.length,
  });

  const rl = readline.createInterface({ input: stream });
  return new Promise<void>((resolve, reject) => {
    rl.on("line", (row) => {
      const [fileName, lines, characters, comment] = row.split(",");
      const [lineStart, lineEnd] = lines.split("-").map(Number);
      const [characterStart, characterEnd] = characters.split("-").map(Number);

      const commentObject: CommentType = {
        fileName: fileName.trim(),
        lineStart,
        lineEnd,
        characterStart,
        characterEnd,
        comment: comment.trim(),
      };

      comments.push(commentObject);
    });

    rl.on("close", () => {
      resolve();
    });

    rl.on("error", (err) => {
      reject(err);
    });
  });
}

async function getComments() {
  comments = [];
  iconDecoration = [];
  highlightDecoration = [];
  activeEditor.setDecorations(icon, []);
  activeEditor.setDecorations(highlight, []);

  await readFromCSV();

  const fileName: string = activeEditor.document.fileName;
  const fileComments = comments.filter(
    (comment) => comment.fileName === fileName
  );

  fileComments.forEach((comment) => {
    const { lineStart, lineEnd, characterStart, characterEnd } = comment;
    const start = new Position(lineStart - 1, characterStart - 1);
    const end = new Position(lineEnd - 1, characterEnd - 1);
    const lineLength = activeEditor.document.lineAt(lineEnd - 1).text.length;
    const lineStartPosition = new Position(lineEnd - 1, 0);
    const lineEndPosition = new Position(lineEnd - 1, lineLength);

    iconDecoration.push({
      range: new Range(lineStartPosition, lineEndPosition),
    });
    highlightDecoration.push({ range: new Range(start, end) });
  });

  activeEditor.setDecorations(icon, iconDecoration);
  activeEditor.setDecorations(highlight, highlightDecoration);
}

export function deactivate() {
  if (panel) {
    panel.dispose();
    activeEditor = window.visibleTextEditors[0];
  }
}
