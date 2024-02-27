import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

let panel: vscode.WebviewPanel;
let panel2: vscode.WebviewPanel;

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showCommentSidebar", () => {
      panel = vscode.window.createWebviewPanel(
        "commentSidebar",
        "Comment Sidebar",
        vscode.ViewColumn.Two,
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
      const htmlFilePath1 = vscode.Uri.joinPath(
        context.extensionUri,
        "src",
        "webview.html"
      );

      vscode.workspace.fs.readFile(htmlFilePath1).then((htmlContent) => {
        const htmlString = new TextDecoder().decode(htmlContent);

        const htmlWithInjectedContext = htmlString.replace(
          "${cssPath}",
          cssUri.toString()
        );
        panel.webview.html = htmlWithInjectedContext;
      });

      panel2 = vscode.window.createWebviewPanel(
        "generalComment",
        "General Comment",
        vscode.ViewColumn.Three,
        {
          enableScripts: true,
        }
      );

      const htmlFilePath2 = vscode.Uri.joinPath(
        context.extensionUri,
        "src",
        "general-comments.html"
      );

      vscode.workspace.fs.readFile(htmlFilePath2).then((htmlContent) => {
        const htmlString = new TextDecoder().decode(htmlContent);

        const htmlWithInjectedContext = htmlString.replace(
          "${cssPath}",
          cssUri.toString()
        );
        panel2.webview.html = htmlWithInjectedContext;
      });
    }));}

export function deactivate() {
  if (panel) {
    panel.dispose();
  }
}
