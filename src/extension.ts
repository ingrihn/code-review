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
} from "vscode";
import path from "path";


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

    const cssUri = webviewView.webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'src', 'custom.css'));

    const htmlFilePath = Uri.joinPath(
      this._extensionUri,
      "src",
      "general-comments.html"
    );

    fs.readFile(htmlFilePath.fsPath, "utf-8", async (err, data) => {
      if (err) {
        window.showErrorMessage(
          `Error reading HTML file: ${err.message}`
        );
        return;
      }
  
      if (this._view) {
        const filePath = getFilePath("rubrics.json");
        const rubricsJson = await getRubricsJson(filePath);
        webviewView.webview.html = data.replace("${cssPath}", cssUri.toString());
        webviewView.webview.postMessage({ command: 'rubricsJson', data: rubricsJson });
      }
    });
  }
}


let panel: WebviewPanel;
let activeEditor: TextEditor;
let generalViewProvider: GeneralViewProvider;
let iconDecoration: DecorationOptions[] = [];
let highlightDecoration: DecorationOptions[] = [];
let icon: TextEditorDecorationType;
let highlight: TextEditorDecorationType;
const commentsFile: string = "comments.json";

export async function activate(context: ExtensionContext) {
  const treeDataProvider = new InlineCommentProvider();
  const viewId = 'collabrate-inline';
  generalViewProvider = new GeneralViewProvider(context.extensionUri);
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

  const filePath = getFilePath("comments.json");
  if (filePath) {
    showComments(filePath);
  }

context.subscriptions.push(
  window.registerWebviewViewProvider(GeneralViewProvider.viewType, {
      resolveWebviewView: (webviewView, _context, _token) => {
          const disposable = webviewView.onDidChangeVisibility(async e => {
            const filePath = getFilePath("rubrics.json");
            const rubricsJson = await getRubricsJson(filePath);
            await webviewView.webview.postMessage({ command: 'rubricsJson', data: rubricsJson });
          });
          context.subscriptions.push (disposable);
          return generalViewProvider.resolveWebviewView(webviewView, _context, _token);
      }
  })
);
 
  window.registerTreeDataProvider(
    viewId,
    treeDataProvider
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
      if (editor && filePath) {
        activeEditor = editor;
        showComments(filePath);
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
  const jsonFilePath = getFilePath(commentsFile);

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

async function readFromFile(filePath: string) {
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

async function getComments(filePath: string): Promise<CommentType[]> {
  try {
    if (activeEditor) {
      const fileName = activeEditor.document.fileName;
      const existingComments = await readFromFile(filePath);
      return existingComments.filter(
        (comment: CommentType) => comment.fileName === fileName
      );
    } else {
      return [];
    }
  } catch (error) {
    console.error(`Error getting comments: ${error}`);
    return [];
  }
}

async function showComments(filePath: string) {
  // Empty arrays to avoid duplicate decoration when adding a new comment
  iconDecoration = [];
  highlightDecoration = [];

  const fileComments = await getComments(filePath);
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

function getFilePath(fileName: string) {
  const workspaceFolders = workspace.workspaceFolders;
  if (!workspaceFolders) {
    window.showErrorMessage("No workspace folders found.");
    return "";
  }
  const workspaceFolder = workspaceFolders[0];
  if (!workspaceFolder) {
    window.showErrorMessage("No workspace folder found.");
  }
  return path.join(workspaceFolder.uri.fsPath, fileName);
}

async function getRubricsJson(filePath: string) {
  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === "ENOENT") {
      await fs.promises.writeFile(filePath, '{"rubrics": []}');
      return [];
    } else {
      console.error(error);
      return [];
    }
  }
}


export function deactivate() {
  if (panel) {
    panel.dispose();
    // activeEditor = window.visibleTextEditors[0];
  }
}
