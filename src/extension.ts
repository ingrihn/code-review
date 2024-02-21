import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

let panel: vscode.WebviewPanel;

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
      });
    })
  );
}

export function deactivate() {
  if (panel) {
    panel.dispose();
  }
}
