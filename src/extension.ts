import * as fs from "fs";

import {
  DecorationOptions,
  ExtensionContext,
  Position,
  StatusBarAlignment,
  StatusBarItem,
  TextEditor,
  TextEditorDecorationType,
  TextEditorSelectionChangeEvent,
  TreeView,
  Uri,
  ViewColumn,
  WebviewPanel,
  commands,
  window,
} from "vscode";
import {
  checkIfFileExists,
  deleteInlineComment,
  getFilePath,
  getRelativePath,
  saveInlineComment,
  saveDraft,
  submitReview,
  updateComment,
} from "./utils/file-utils";
import {
  convertFromGeneralComment,
  getInlineComment,
  getGeneralComments,
  showInlineComments,
} from "./utils/comment-utils";
import {
  highPriorityIconUri,
  initialiseIconUris,
  lowPriorityIconUri,
  mediumPriorityIconUri,
} from "./assets/icon-uris";

import { GeneralViewProvider } from "./general-view-provider";
import { InlineComment } from "./comment";
import { InlineCommentItemProvider } from "./inline-comment-item-provider";
import path from "path";
import { InlineCommentItem } from "./inline-comment-item";

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
const viewId = "reviewify-inline";
let isFirstWebviewPanel: boolean = true;
let webviewPanelHtml: string;
let treeView: TreeView<InlineCommentItem>;
let submitItem: StatusBarItem;

/**
 * Defines the extension's core functionality.
 * @param {ExtensionContext} context - The context in which the extension is activated.
 */
export async function activate(context: ExtensionContext) {
  treeDataProvider = new InlineCommentItemProvider();
  generalViewProvider = new GeneralViewProvider(context.extensionUri);
  activeEditor = window.activeTextEditor ?? window.visibleTextEditors[0];

  // Declares icons
  icon = window.createTextEditorDecorationType({
    after: {
      contentIconPath: context.asAbsolutePath(
        path.join("src", "assets", "dark-comment.svg")
      ),
      margin: "5px",
    },
    dark: {
      after: {
        contentIconPath: context.asAbsolutePath(
          path.join("src", "assets", "light-comment.svg")
        ),
        margin: "5px",
      },
    },
  });
  highlight = window.createTextEditorDecorationType({
    backgroundColor: "#4e4aa150",
    dark: {
      backgroundColor: "#cd7cff50",
    },
  });
  initialiseIconUris(context);

  // Creates JSON files if they do not already exist
  const inlineCommentsJson = getFilePath(INLINE_COMMENTS_FILE);
  const generalCommentsJson = getFilePath(GENERAL_COMMENTS_FILE);
  const rubricsJson = getFilePath("rubrics.json");
  if (checkIfFileExists(inlineCommentsJson, "inlineComments")) {
    showInlineComments(inlineCommentsJson);
  }
  checkIfFileExists(generalCommentsJson, "generalComments");
  checkIfFileExists(rubricsJson, "rubrics");

  // Registers provider for the webview view and shows it every time it is opened
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

  // Creates tree view in the panel
  treeView = window.createTreeView(viewId, {
    treeDataProvider,
    showCollapseAll: true,
    canSelectMany: false,
  });

  // Registers command to show the tree view when executed
  context.subscriptions.push(
    commands.registerCommand("reviewify.showOverview", () => {
      treeDataProvider.getFirstElement().then((firstElement) => {
        if (firstElement) {
          treeView.reveal(firstElement, { select: false, focus: false });
        }
      });
    })
  );

  commands.executeCommand("reviewify.showOverview");

  // Shows the webview panel
  context.subscriptions.push(
    commands.registerCommand(
      "reviewify.showCommentSidebar",
      async (comment?: InlineComment) => {
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

        // Initialises the webview panel's properties the first time it is opened
        if (isFirstWebviewPanel) {
          await initialiseWebviewPanel(context);
          isFirstWebviewPanel = false;
        }

        if (webviewPanelHtml) {
          // Gets values from clicked inline comment
          const commentText = comment?.comment || "";
          const title = comment?.title || "";
          const commentId = comment?.id || "";
          const priority = comment?.priority || "";

          // Shows the inline comment in the webview panel
          let htmlContent = webviewPanelHtml
            .replace("${commentText}", commentText)
            .replace("${commentId}", commentId.toString())
            .replace("${commentTitle}", title);

          if (priority) {
            htmlContent = htmlContent.replace(
              `value="${priority}"`,
              `value="${priority}" checked`
            );
          }

          panel.webview.html = htmlContent;
        }

        panel.webview.onDidReceiveMessage(
          handleMessageFromWebview,
          undefined,
          context.subscriptions
        );
      }
    )
  );

  // Retrieves relevant inline comments when changing file
  context.subscriptions.push(
    window.onDidChangeActiveTextEditor((editor: TextEditor | undefined) => {
      if (editor && inlineCommentsJson) {
        activeEditor = editor;
        showInlineComments(inlineCommentsJson);
      }
    })
  );

  // Shows inline comment in webview panel when clicking highlighted code
  context.subscriptions.push(
    window.onDidChangeTextEditorSelection(
      async (event: TextEditorSelectionChangeEvent) => {
        // Prevents unwanted behaviour with multi-selection
        const selection = event.selections[0];
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
            const comment: InlineComment | undefined = await getInlineComment(
              clickedHighlight.range
            );
            if (comment) {
              commands.executeCommand("reviewify.showCommentSidebar", comment);
            }
          }
        }
      }
    )
  );

  // Registers command for submitting a review
  context.subscriptions.push(
    commands.registerCommand("reviewify.submitReview", async () => {
      if (generalViewProvider.getDisplayRubrics()) {
        if (
          generalViewProvider.getView() !== undefined &&
          generalViewProvider.getView()?.visible
        ) {
          generalViewProvider
            .getView()!
            .webview.postMessage("getGeneralCommentsSubmit");
        } else {
          const generalComments = await getGeneralComments();
          const commentsToSave: {
            comment: string;
            score?: number;
            rubricId: number;
          }[] = convertFromGeneralComment(generalComments);
          submitReview(commentsToSave, generalViewProvider);
        }
      } else {
        window.showInformationMessage("You have already submitted your review.");
      }
    })
  );

  // Adds submit button to status bar
  submitItem = window.createStatusBarItem(StatusBarAlignment.Left);
  submitItem.text = "$(feedback) " + "Submit review";
  submitItem.tooltip = "Click when code review is finished";
  submitItem.command = "reviewify.submitReview";
  submitItem.show();
  context.subscriptions.push(submitItem);
}

/**
 * Handles messages received from the webview panel or webview view.
 * @param {any} message - The message received from the webview panel or webview view.
 */
export function handleMessageFromWebview(message: any) {
  switch (message.command) {
    case "saveComment":
      const commentText = message.data.text;
      const fileName = getRelativePath();
      const title = message.data.title;
      const priority = message.data.priority;
      saveInlineComment(
        fileName,
        activeEditor.selection,
        title,
        commentText,
        priority
      );
      break;
    case "deleteComment":
      const { id: commentId } = message;
      deleteInlineComment(commentId);
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
      saveDraft(commentsData);
      break;
    case "submitReview":
      const generalCommentsData = message.data;
      submitReview(generalCommentsData, generalViewProvider);
      break;
    case "showOverview":
      commands.executeCommand("reviewify.showOverview");
      break;
    default:
      break; // Handles unknown command
  }
}

/**
 * Sets the URIs for HTML, CSS, and icons for the webview panel.
 * @param {ExtensionContext} context - The context in which the extension is running.
 * @throws {unknown}
 */
async function initialiseWebviewPanel(context: ExtensionContext) {
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

  try {
    const html = await fs.promises
      .readFile(webviewPath.fsPath, "utf-8");
    webviewPanelHtml = html
      .replace("${cssUri}", cssUri.toString())
      .replace("${lowPriorityIconUri}", webviewLowPriorityIcon)
      .replace("${mediumPriorityIconUri}", webviewMediumPriorityIcon)
      .replace("${highPriorityIconUri}", webviewHighPriorityIcon);
  } catch (error) {
    console.error("Error reading HTML file:", error);
    throw error;
  }
}

export function disposePanel() {
  if (panel) {
    panel.dispose();
  }
}

export function emptyDecorations() {
  iconDecoration = [];
  highlightDecoration = [];
}

/**
 * Cleans up resources when extension is deactivated.
 */
export function deactivate() {
  disposePanel();
  emptyDecorations();
  if (activeEditor) {
    activeEditor.setDecorations(icon, []);
    activeEditor.setDecorations(highlight, []);
  }
  if (treeView) {
    treeView.dispose();
  }
  if (submitItem) {
    submitItem.dispose();
  }
  isFirstWebviewPanel = true;
}
