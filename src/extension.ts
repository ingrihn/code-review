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
  TreeItem,
  TreeDataProvider,
  TreeItemCollapsibleState,
  EventEmitter,
  Event,
  WebviewViewProvider,
  WebviewView,
  WebviewViewResolveContext,
  CancellationToken,
  TreeView
} from "vscode";
import path from "path";


class InlineComment extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);
  }
}

class InlineCommentProvider implements TreeDataProvider<InlineComment> {
  private _onDidChangeTreeData: EventEmitter<InlineComment | undefined> = new EventEmitter<InlineComment | undefined>();
  readonly onDidChangeTreeData: Event<InlineComment | undefined> = this._onDidChangeTreeData.event;

  refresh(comment?: InlineComment): void {
    this._onDidChangeTreeData.fire(comment);
  }

  getTreeItem(element: InlineComment): TreeItem {
    return element;
  } 

  getChildren(element?: InlineComment): Thenable<InlineComment[]> {
    const items: InlineComment[] = [
      new InlineComment('Item 1', TreeItemCollapsibleState.None),
      new InlineComment('Item 2', TreeItemCollapsibleState.None),
    ];

    return Promise.resolve(items);
  }
}

class GeneralViewProvider implements WebviewViewProvider {
  public static readonly viewType = 'collabrate-general';
  private _view?: WebviewView;

  constructor(
		private readonly _extensionUri: Uri,
	) { }

  getView(): WebviewView | undefined {
    return this._view;
  }

  public resolveWebviewView(
		webviewView: WebviewView,
		context: WebviewViewResolveContext,
		_token: CancellationToken,
	) {
		this._view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
		};

    const rubricsJson = getRubricsJson();
    webviewView.webview.postMessage({ command: 'rubricsJson', data: rubricsJson });

    const cssUri = webviewView.webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'src', 'custom.css'));

    const htmlFilePath = Uri.joinPath(
      this._extensionUri,
      "src",
      "general-comments.html"
    );

    fs.readFile(htmlFilePath.fsPath, "utf-8", (err, data) => {
      if (err) {
        window.showErrorMessage(
          `Error reading HTML file: ${err.message}`
        );
        return;
      }
  
      if (this._view) {
        this._view.webview.html = data.replace("${cssPath}", cssUri.toString());
      }
    });
  }
}


let treeView: TreeView<InlineComment>;
let panel: WebviewPanel;
let activeEditor: TextEditor;

export async function activate(context: ExtensionContext) {
  const treeDataProvider = new InlineCommentProvider();
  const viewId = 'collabrate-inline';
  const generalViewProvider = new GeneralViewProvider(context.extensionUri);

  context.subscriptions.push(
		window.registerWebviewViewProvider(GeneralViewProvider.viewType, generalViewProvider));

  window.registerTreeDataProvider(
    viewId,
    treeDataProvider
  );

  activeEditor = window.activeTextEditor ?? window.visibleTextEditors[0];
  const filePath = getFilePath("comments.json");
  await showFileComments(filePath, context);

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
          window.showErrorMessage(
            `Error reading HTML file: ${err.message}`
          );
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
  )
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        activeEditor = editor;
        showFileComments(filePath, context);
      }
    })
  );
  }



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


function handleMessageFromWebview(message: any) {
  switch (message.command) {
    case "getText":
      const filePath = getFilePath("comments.json");
      const fileName = activeEditor.document.fileName;
      const { commentText } = message;
      saveToFile(filePath, fileName, activeEditor.selection, commentText);
      deactivate();
  }
}

async function getComments(filePath: string): Promise<CommentType[]> {
  try {
    const existingComments = await readFromFile(filePath);
    const fileName = activeEditor.document.fileName;
    return existingComments.filter((comment) => comment.fileName === fileName);
  } catch (error) {
    console.error(`Error getting comments: ${error}`);
    return [];
  }
}

async function showFileComments(filePath: string, context: ExtensionContext) {
  const fileComments = await getComments(filePath);
  const iconDecoration: DecorationOptions[] = [];
  const highlightDecoration: DecorationOptions[] = [];

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

async function saveToFile(
  filePath: string,
  fileName: string,
  selection: Selection,
  commentText: string
) {
  try {
    const commentData: CommentType = {
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
    existingComments.push(commentData);
    const commentJson = JSON.stringify({ comments: existingComments });
    await fs.promises.writeFile(filePath, commentJson);
  } catch (error) {
    console.error(`Error saving to file: ${error}`);
  }
}

function getFilePath(fileName: string) {
  const docUri = activeEditor.document.uri;
  const workspaceFolder = workspace.getWorkspaceFolder(docUri);
  if (!workspaceFolder) {
    window.showErrorMessage("No workspace folder found.");
    return "";
  }
  return path.join(workspaceFolder.uri.fsPath, fileName);
}

function getRubricsJson() {
  const filePath = '../rubrics.json';
  
  // const cssPath = Uri.joinPath(context.extensionUri, "src", "custom.css");
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading rubrics.json:', error);
    return null;
  }
}


export function deactivate() {
  if (panel) {
    panel.dispose();
    activeEditor = window.visibleTextEditors[0];
  }
  if (treeView) {
    treeView.dispose();
  }
}
