import * as fs from "fs";

import {
  DecorationOptions,
  ExtensionContext,
  Position,
  Range,
  StatusBarAlignment,
  TextEditor,
  TextEditorDecorationType,
  TextEditorSelectionChangeEvent,
  Uri,
  ViewColumn,
  WebviewPanel,
  commands,
  window,
} from "vscode";
import {
  checkIfFileExists,
  deleteComment,
  getFilePath,
  getRelativePath,
  saveComment,
  saveGeneralComments,
  updateComment,
} from "./utils/file-utils";
import { getComment, showComments, submitReview } from "./utils/comment-utils";
import {
  highPriorityIconUri,
  initializeIconUris,
  lowPriorityIconUri,
  mediumPriorityIconUri,
} from "./assets/icon-uris";

import { GeneralViewProvider } from "./general-view-provider";
import { InlineComment } from "./comment";
import { InlineCommentItemProvider } from "./inline-comment-item-provider";
import path from "path";

export let activeEditor: TextEditor;
export let treeDataProvider: InlineCommentItemProvider;
export let iconDecoration: DecorationOptions[] = [];
export let highlightDecoration: DecorationOptions[] = [];
export let icon: TextEditorDecorationType;
export let highlight: TextEditorDecorationType;
export const INLINE_COMMENTS_FILE = "inline-comments.json";
export const GENERAL_COMMENTS_FILE = "general-comments.json";
let generalViewProvider: GeneralViewProvider;
let panel: WebviewPanel;
const viewId = "collabrate-inline";

export async function activate(context: ExtensionContext) {
  treeDataProvider = new InlineCommentItemProvider();
  generalViewProvider = new GeneralViewProvider(context.extensionUri);
  activeEditor = window.activeTextEditor ?? window.visibleTextEditors[0];

  // Declare icons
  icon = window.createTextEditorDecorationType({
    after: {
      contentIconPath: context.asAbsolutePath(
        path.join("src", "assets", "comment.svg")
      ),
      margin: "5px",
    },
  });
  highlight = window.createTextEditorDecorationType({
    backgroundColor: "#8CBEB260",
  });
  initializeIconUris(context);

  // Makes JSON files if they don't already exist
  const commentsJson = getFilePath(INLINE_COMMENTS_FILE);
  const generalCommentsJson = getFilePath(GENERAL_COMMENTS_FILE);
  const rubricsJson = getFilePath("rubrics.json");
  if (checkIfFileExists(commentsJson, "inlineComments")) {
    showComments(commentsJson);
  }
  checkIfFileExists(generalCommentsJson, "generalComments");
  checkIfFileExists(rubricsJson, "rubrics");

  // Register provider for the webview view and show it every time it is opened
  context.subscriptions.push(
    window.registerWebviewViewProvider(GeneralViewProvider.viewType, {
      resolveWebviewView: async (webviewView, _context, _token) => {
        await generalViewProvider.resolveWebviewView(
          webviewView,
          _context,
          _token
        );
        context.subscriptions.push(
          webviewView.onDidChangeVisibility(async (e) => {
            try {
              await generalViewProvider.resolveWebviewView(
                webviewView,
                _context,
                _token
              );
            } catch (error) {
              console.error("Error fetching rubrics JSON:", error);
            }
          })
        );
        context.subscriptions.push(
          webviewView.webview.onDidReceiveMessage((message) => {
            handleMessageFromWebview(message);
          })
        );
      },
    })
  );

  // Create tree view in the panel
  const treeView = window.createTreeView(viewId, {
    treeDataProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // Register command to show the tree view when executed
  context.subscriptions.push(
    commands.registerCommand("extension.showOverview", () => {
      treeDataProvider.getFirstElement().then((firstElement) => {
        if (firstElement) {
          treeView.reveal(firstElement, { select: false, focus: false });
        }
      });
    })
  );

  commands.executeCommand("extension.showOverview");

  // Shows the webview panel
  context.subscriptions.push(
    commands.registerCommand(
      "extension.showCommentSidebar",
      (comment?: InlineComment) => {
        if (panel) {
          panel.dispose();
        }

        panel = window.createWebviewPanel(
          "commentSidebar",
          "Inline Comment",
          ViewColumn.Beside,
          {
            enableScripts: true,
          }
        );

        const webviewPath = Uri.joinPath(
          context.extensionUri,
          "src/inline-comment.html"
        );
        const cssUri = panel.webview.asWebviewUri(
          Uri.joinPath(context.extensionUri, "src/styles/style.css")
        );
        const webviewLowPriorityIcon = panel.webview
          .asWebviewUri(lowPriorityIconUri)
          .toString();
        const webviewMediumPriorityIcon = panel.webview
          .asWebviewUri(mediumPriorityIconUri)
          .toString();
        const webviewHighPriorityIcon = panel.webview
          .asWebviewUri(highPriorityIconUri)
          .toString();

        fs.promises
          .readFile(webviewPath.fsPath, "utf-8")
          .then((data) => {
            // Get values from clicked comment
            const commentText = comment?.comment || "";
            const title = comment?.title || "";
            const commentId = comment?.id || "";
            const priority = comment?.priority || "";

            // Shows the comment's value in the webview HTML
            let htmlContent = data
              .replace("${cssUri}", cssUri.toString())
              .replace("${commentText}", commentText)
              .replace("${commentId}", commentId.toString())
              .replace("${commentTitle}", title)
              .replace("${lowPriorityIconUri}", webviewLowPriorityIcon)
              .replace("${mediumPriorityIconUri}", webviewMediumPriorityIcon)
              .replace("${highPriorityIconUri}", webviewHighPriorityIcon);

            if (priority) {
              htmlContent = htmlContent.replace(
                `value="${priority}"`,
                `value="${priority}" checked`
              );
            }

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
          const clickedHighlight = highlightDecoration.find((decoration) =>
            decoration.range.contains(clickedPosition)
          );

          if (clickedHighlight) {
            const comment: InlineComment | undefined = await getComment(
              clickedHighlight.range
            );
            if (comment) {
              commands.executeCommand("extension.showCommentSidebar", comment);
            }
          }
        }
      }
    )
  );

  // Register command for submitting all comments
  context.subscriptions.push(
    commands.registerCommand("extension.submitReview", async () => {
      submitReview();
    })
  );

  // Add submit button to status bar
  const submitItem = window.createStatusBarItem(StatusBarAlignment.Left);
  submitItem.text = "$(feedback) " + "Submit review";
  submitItem.tooltip = "Select when code review is finished";
  submitItem.command = "extension.submitReview";
  submitItem.show();
  context.subscriptions.push(submitItem);
}

/**
 * Handles messages received from the webview panel or webview view.
 * @param {any} message - The message received from the webview.
 */
export function handleMessageFromWebview(message: any) {
  switch (message.command) {
    case "saveComment":
      const commentText = message.data.text;
      const fileName = getRelativePath();
      const title = message.data.title;
      const priority = message.data.priority;
      saveComment(
        fileName,
        activeEditor.selection,
        title,
        commentText,
        priority
      );
      break;
    case "deleteComment":
      const { id: commentId } = message;
      deleteComment(commentId);
      break;
    case "updateComment":
      const newCommentId = message.data.id;
      const newTitle = message.data.title;
      const newCommentText = message.data.text;
      const newPriority = message.data.priority;
      updateComment(newCommentId, newCommentText, newTitle, newPriority);
      break;
    case "draftStored":
      const commentsData = message.data;
      saveGeneralComments(commentsData);
      break;
    case "submitReview":
      submitReview();
      break;
    case "showOverview":
      commands.executeCommand("extension.showOverview");
      break;
    default:
      deactivate();
      break; // Handle unknown command
  }
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
