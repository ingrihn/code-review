import * as fs from "fs";

import {
  DecorationOptions,
  ExtensionContext,
  Position,
  Range,
  TextEditor,
  TextEditorDecorationType,
  TextEditorSelectionChangeEvent,
  Uri,
  ViewColumn,
  WebviewPanel,
  commands,
  window,
} from "vscode";
import { checkIfFileExists, getFilePath } from "./utils/file-utils";
import {
  getComment,
  handleMessageFromWebview,
  showComments,
} from "./utils/comment-utils";

import { CommentType } from "./comment-type";
import { GeneralViewProvider } from "./general-view-provider";
import { InlineCommentProvider } from "./inline-comment-provider";
import path from "path";

export let activeEditor: TextEditor;
export let treeDataProvider: InlineCommentProvider;
export let iconDecoration: DecorationOptions[] = [];
export let highlightDecoration: DecorationOptions[] = [];
export let icon: TextEditorDecorationType;
export let highlight: TextEditorDecorationType;
export const COMMENTS_FILE = "comments.json";
export const GENERAL_COMMENTS_FILE = "general-comments.json";
let generalViewProvider: GeneralViewProvider;
let panel: WebviewPanel;
const viewId = "collabrate-inline";

export async function activate(context: ExtensionContext) {
  treeDataProvider = new InlineCommentProvider();
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

  // Makes JSON files if they don't already exist
  const commentsJson = getFilePath(COMMENTS_FILE);
  const generalCommentsJson = getFilePath(GENERAL_COMMENTS_FILE);
  const rubricsJson = getFilePath("rubrics.json");
  if (checkIfFileExists(commentsJson, "comments")) {
    showComments(commentsJson);
  }
  checkIfFileExists(generalCommentsJson, "generalComments");
  checkIfFileExists(rubricsJson, "rubrics");

  // Register provider for the webview view and show it every time it is opened
  context.subscriptions.push(
    window.registerWebviewViewProvider(GeneralViewProvider.viewType, {
        resolveWebviewView: async (webviewView, _context, _token) => {
          await generalViewProvider.resolveWebviewView(webviewView, _context, _token);
          context.subscriptions.push(webviewView.onDidChangeVisibility(async e => {
          try {
            await generalViewProvider.resolveWebviewView(webviewView, _context, _token);
          } catch (error) {
            console.error('Error fetching rubrics JSON:', error);
          }
          }));
          context.subscriptions.push(webviewView.webview.onDidReceiveMessage((message) => {
            handleMessageFromWebview(message);
          }));
        }
    })
  );
  
  // Register provider for the tree view
  window.registerTreeDataProvider(viewId, treeDataProvider);

  // Shows the webview panel
  context.subscriptions.push(
    commands.registerCommand(
      "extension.showCommentSidebar",
      (comment?: CommentType) => {
        if (panel) {
          panel.dispose();
        }

        panel = window.createWebviewPanel(
          "commentSidebar",
          "New Inline Comment",
          ViewColumn.Beside,
          {
            enableScripts: true,
          }
        );

        const webviewPath = Uri.joinPath(
          context.extensionUri,
          "src",
          "webview.html"
        );
        const cssPath = Uri.joinPath(context.extensionUri, "src", "style.css");
        const cssUri = panel.webview.asWebviewUri(cssPath);

        fs.promises
          .readFile(webviewPath.fsPath, "utf-8")
          .then((data) => {
            // Get values from clicked comment
            let commentText = comment && comment.comment ? comment.comment : "";
            let title = comment && comment.title ? comment.title : "";
            let commentId = comment && comment.id ? comment.id : "";

            // Shows the comment's value in the webview HTML
            let htmlContent = data
              .replace("${cssPath}", cssUri.toString())
              .replace("${commentText}", commentText)
              .replace("${commentId}", commentId.toString())
              .replace("${commentTitle}", title);

            panel.webview.html = htmlContent;
          })
          .catch((error) => {
            window.showErrorMessage(
              `Error reading HTML file: ${error.message}`
            );
          });

        panel.webview.onDidReceiveMessage(
          handleMessageFromWebview,
          undefined,
          context.subscriptions
        );
      }
    )
  );

  // Get right comments when changing files
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
      if (editor && commentsJson) {
        activeEditor = editor;
        showComments(commentsJson);
      }
    })
  );

  // Click on highlighted text to view comment in webview
  context.subscriptions.push(
    window.onDidChangeTextEditorSelection(
      async (event: TextEditorSelectionChangeEvent) => {
        const selection = event.selections[0];
        // Prevents unwanted behaviour with multi-selection
        if (
          activeEditor &&
          selection.anchor.isEqual(selection.active) &&
          selection.start.line === selection.end.line
        ) {
          const clickedPosition: Position = activeEditor.selection.active;
          let highlightedRange: Range | undefined;
          const isHighlightedClicked = highlightDecoration.some(
            (decoration) => {
              if (decoration.range.contains(clickedPosition)) {
                highlightedRange = decoration.range;
                return true; // Stop once a match is found
              }
              return false;
            }
          );

          if (isHighlightedClicked && highlightedRange) {
            const comment: CommentType | undefined = await getComment(
              highlightedRange
            );
            if (comment) {
              commands.executeCommand("extension.showCommentSidebar", comment);
            }
          }
        }
      }
    )
  );
}

export function emptyDecoration() {
  iconDecoration = [];
  highlightDecoration = [];
}

export function deactivate() {
  if (panel) {
    panel.dispose();
  }
}
