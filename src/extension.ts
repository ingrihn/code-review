import * as fs from "fs";
import * as vscode from "vscode";

import path from "path";

let panel: vscode.WebviewPanel;
let activeEditor: vscode.TextEditor | undefined;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showCommentSidebar", () => {
      panel = vscode.window.createWebviewPanel(
        "commentSidebar",
        "Comment Sidebar",
        vscode.ViewColumn.Beside,
        {
          enableScripts: true,
        }
      );

      activeEditor = vscode.window.activeTextEditor;

      const cssDiskPath = vscode.Uri.joinPath(
        context.extensionUri,
        "src",
        "custom.css"
      );
      const cssUri = panel.webview.asWebviewUri(cssDiskPath);
      const htmlFilePath = vscode.Uri.joinPath(
        context.extensionUri,
        "src",
        "webview.html"
      );

      fs.readFile(htmlFilePath.fsPath, "utf-8", (err, data) => {
        if (err) {
          vscode.window.showErrorMessage(
            `Error reading HTML file: ${err.message}`
          );
          return;
        }

        panel.webview.html = data.replace("${cssPath}", cssUri.toString());

        panel.webview.onDidReceiveMessage(
          (message) => {
            handleMessageFromWebview(message, context);
          },
          undefined,
          context.subscriptions
        );
      });
    })
  );
}

function handleMessageFromWebview(
  message: any,
  context: vscode.ExtensionContext
) {
  switch (message.command) {
    case "getText":
      const text = message.text;
      const selection = activeEditor?.selection;
      console.log(selection?.start);
      console.log(selection?.end);
      let key: string = "";

      if (activeEditor && selection) {
        key = createKey(
          activeEditor?.document.fileName,
          selection.start,
          selection.end
        );

        // Store comment locally
        const workspaceState = context.workspaceState;
        workspaceState.update(key, text).then(() => {
          vscode.window.showInformationMessage("Comment saved successfully!");
          console.log("yeehaw " + workspaceState.get(key));
        });

        deactivate();
        setDecoration(context, selection);
      } else {
        vscode.window.showErrorMessage("No active text editor found.");
      }

      break;
  }
}

function setDecoration(
  context: vscode.ExtensionContext,
  selection: vscode.Selection
) {
  const icon = vscode.window.createTextEditorDecorationType({
    after: {
      contentIconPath: context.asAbsolutePath(path.join("src", "comment.svg")),
    },
  });

  const decorationOptions: vscode.DecorationOptions[] = [];
  const lineNumber = selection.end.line; // Get the line number of the selected line
  const line = activeEditor?.document.lineAt(lineNumber); // Get the selected line
  console.log(lineNumber);
  console.log(line);

  if (line) {
    const position = new vscode.Position(lineNumber, line.range.end.character); // Set decoration at the end of the selected line
    decorationOptions.push({ range: new vscode.Range(position, position) });
    activeEditor?.setDecorations(icon, decorationOptions);
  }
}

function createKey(
  filePath: string,
  start: vscode.Position,
  end: vscode.Position
): string {
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
  }
}
