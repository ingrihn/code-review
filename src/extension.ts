import * as fs from "fs";

import {
  DecorationOptions,
  ExtensionContext,
  Memento,
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

let panel: WebviewPanel;
let activeEditor: TextEditor;
let decorationOptions: DecorationOptions[];
let workspaceState: Memento;
let icon: TextEditorDecorationType;
let ctx: ExtensionContext;

export function activate(context: ExtensionContext) {
  ctx = context;

  context.subscriptions.push(
    commands.registerCommand("extension.startReview", () => {
      decorationOptions = [];
      activeEditor = window.activeTextEditor ?? window.visibleTextEditors[0];
      workspaceState = context.workspaceState;
      // clearWorkspaceState();
      icon = window.createTextEditorDecorationType({
        after: {
          contentIconPath: context.asAbsolutePath(
            path.join("src", "comment.svg")
          ),
          margin: "5px",
        },
      });
      getComments();
    })
  );

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

      const cssDiskPath = Uri.joinPath(
        context.extensionUri,
        "src",
        "custom.css"
      );
      const cssUri = panel.webview.asWebviewUri(cssDiskPath);
      const htmlFilePath = Uri.joinPath(
        context.extensionUri,
        "src",
        "webview.html"
      );

      fs.readFile(htmlFilePath.fsPath, "utf-8", (err, data) => {
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
  // Store comment locally
  const key = createKey(fileName, start, end);
  workspaceState.update(key, comment).then(() => {
    window.showInformationMessage("Comment saved successfully!");
  });

  const csvPath: Uri = Uri.joinPath(ctx.extensionUri, "comments.csv");
  if (!fs.existsSync(csvPath.fsPath)) {
    const header: string = "file,lines,characters,comment\n";
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

  if (line) {
    const position = new Position(lineNumber, lineEnd);
    decorationOptions.push({ range: new Range(position, position) });
    activeEditor.setDecorations(icon, decorationOptions);
  }
}

function getComments() {
  decorationOptions = [];
  activeEditor.setDecorations(icon, []);

  const fileName: string = activeEditor.document.fileName;
  const commentsForFile = workspaceState
    .keys()
    .filter((key) => key.startsWith(fileName));

  commentsForFile.forEach((key) => {
    // const commentText = workspaceState.get(key);
    const suffix: number = key.indexOf(".tsx_");
    const codeLines: number[] = key
      .substring(suffix + 5)
      .split("_")
      .map((value) => parseInt(value));

    // start.line, end.line, start.character, end.character
    const position = new Position(codeLines[1] - 1, codeLines[3] - 1);
    decorationOptions.push({ range: new Range(position, position) });
  });

  // Only set decorations if the active editor is the same as before
  if (window.activeTextEditor === activeEditor) {
    activeEditor.setDecorations(icon, decorationOptions);
  }
}

function createKey(filePath: string, start: Position, end: Position): string {
  return (
    filePath +
    "_" +
    findCodeLine(start.line) +
    "_" +
    findCodeLine(end.line) +
    "_" +
    findCodeLine(start.character) +
    "_" +
    findCodeLine(end.character)
  );
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
