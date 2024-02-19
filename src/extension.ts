import * as path from "path";
import * as vscode from "vscode";

let commentPanel: vscode.WebviewPanel | undefined;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("extension.showCommentSidebar", () => {
      const panel = vscode.window.createWebviewPanel(
        "commentSidebar",
        "Comment Sidebar",
        vscode.ViewColumn.Beside,
        {}
      );

      getWebviewContent(context).then((content) => {
        panel.webview.html = content;
      });
    })
  );
}

async function getWebviewContent(
  context: vscode.ExtensionContext
): Promise<string> {
  const webViewPath = path.join(context.extensionPath, "/src/webview.html");

  const content = await vscode.workspace.fs.readFile(
    vscode.Uri.file(webViewPath)
  );
  return content.toString();
}

// This method is called when your extension is deactivated
function deactivate() {
  if (commentPanel) {
    commentPanel.dispose();
  }
}
