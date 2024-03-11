import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";



class InlineComment extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

class InlineCommentProvider implements vscode.TreeDataProvider<InlineComment> {
  private _onDidChangeTreeData: vscode.EventEmitter<InlineComment | undefined> = new vscode.EventEmitter<InlineComment | undefined>();
  readonly onDidChangeTreeData: vscode.Event<InlineComment | undefined> = this._onDidChangeTreeData.event;

  refresh(comment?: InlineComment): void {
    this._onDidChangeTreeData.fire(comment);
  }

  // constructor(private workspaceRoot: string) {}

  getTreeItem(element: InlineComment): vscode.TreeItem {
    return element;
  }

  getChildren(element?: InlineComment): Thenable<InlineComment[]> {
    const items: InlineComment[] = [
      new InlineComment('Item 1', vscode.TreeItemCollapsibleState.None),
      new InlineComment('Item 2', vscode.TreeItemCollapsibleState.None),
    ];

    return Promise.resolve(items);
  }
}

class GeneralViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'collabrate-general';
  private _view?: vscode.WebviewView;

  constructor(
		private readonly _extensionUri: vscode.Uri,
	) { }


  public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
		};

    const cssUri = webviewView.webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'src', 'custom.css'));

    const htmlFilePath = vscode.Uri.joinPath(
      this._extensionUri,
      "src",
      "general-comments.html"
    );
    fs.readFile(htmlFilePath.fsPath, "utf-8", (err, data) => {
      if (err) {
        vscode.window.showErrorMessage(
          `Error reading HTML file: ${err.message}`
        );
        return;
      }
  
      if (this._view) {
        this._view.webview.html = data.replace("${cssPath}", cssUri.toString());
      }


		// webviewView.webview.onDidReceiveMessage(data => {
		// 	switch (data.type) {
		// 		case 'colorSelected':
		// 			{
		// 				vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
		// 				break;
		// 			}
		// 	}
		// });
  });
}
}

let treeView: vscode.TreeView<InlineComment>;
let panel: vscode.WebviewPanel;

export function activate(context: vscode.ExtensionContext) {
  const treeDataProvider = new InlineCommentProvider();
  const viewId = 'collabrate-inline';
  const generalViewProvider = new GeneralViewProvider(context.extensionUri);

  context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(GeneralViewProvider.viewType, generalViewProvider));

  vscode.window.registerTreeDataProvider(
    viewId,
    treeDataProvider
  );
    //   vscode.commands.registerCommand('extension.refreshEntry', () =>
    //   treeDataProvider.refresh()
    // );

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
}));}


export function deactivate() {
  if (panel) {
    panel.dispose();
  }
  if (treeView) {
    treeView.dispose();
  }
}
