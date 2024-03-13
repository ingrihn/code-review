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
let decorationOptions: DecorationOptions[];
let icon: TextEditorDecorationType;
let ctx: ExtensionContext;
const header: string = "file,lines,characters,comment\n";
let comments: CommentType[];

export function activate(context: ExtensionContext) {
  ctx = context;
  decorationOptions = [];
  activeEditor = window.activeTextEditor ?? window.visibleTextEditors[0];
  comments = [];
  icon = window.createTextEditorDecorationType({
    after: {
      contentIconPath: context.asAbsolutePath(path.join("src", "comment.svg")),
      margin: "5px",
    },
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
      const { selection, document } = activeEditor;
      const fileName = document.fileName;

      saveInCSV(fileName, selection.start, selection.end, commentText);
      deactivate();
      showComment(selection);
  }
}

function saveInCSV(
  fileName: string,
  start: Position,
  end: Position,
  comment: string
) {
  const csvPath: Uri = Uri.joinPath(ctx.extensionUri, "comments.csv");
  if (!fs.existsSync(csvPath.fsPath)) {
    fs.writeFileSync(csvPath.fsPath, header);
  }
  const lines = `${findCodeLine(start.line)}-${findCodeLine(end.line)}`;
  const characters = `${findCodeLine(start.character)}-${findCodeLine(
    end.character
  )}`;
  const csvEntry = `${fileName},${lines},${characters},${comment}\n`;
  fs.appendFileSync(csvPath.fsPath, csvEntry);
}

function showComment(selection: Selection) {
  const lineNumber = selection.end.line;
  const line = activeEditor.document.lineAt(lineNumber);
  const lineEnd = line.text.length;
  console.log(lineEnd);
  if (line) {
    const position = new Position(lineNumber, lineEnd);
    decorationOptions.push({ range: new Range(position, position) });
    activeEditor.setDecorations(icon, decorationOptions);
  }
}

function readFromCSV() {
  const csvPath = path.resolve(__dirname, "../comments.csv");

  const stream = fs.createReadStream(csvPath, {
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
  decorationOptions = [];
  activeEditor.setDecorations(icon, []);
  comments = [];

  await readFromCSV();

  const fileName: string = activeEditor.document.fileName;
  const fileComments = comments.filter(
    (comment) => comment.fileName === fileName
  );
  fileComments.forEach((comment) => {
    const position = new Position(
      comment.lineEnd - 1,
      comment.characterEnd - 1
    );
    decorationOptions.push({ range: new Range(position, position) });
  });

  // Only set decorations if the active editor is the same as before
  if (window.activeTextEditor === activeEditor) {
    activeEditor.setDecorations(icon, decorationOptions);
  }
}

function findCodeLine(codeLine: number): string {
  return (codeLine + 1).toString();
}

export function deactivate() {
  if (panel) {
    panel.dispose();
    activeEditor = window.visibleTextEditors[0];
  }
}
