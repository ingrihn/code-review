import * as fs from "fs";

import {
  COMMENTS_FILE,
  activeEditor,
  deactivate,
  emptyDecoration,
  highlight,
  highlightDecoration,
  icon,
  iconDecoration,
  treeDataProvider,
} from "../extension";
import { Position, Range, window } from "vscode";
import {
  addComment,
  addGeneralComments,
  getFilePath,
  getRelativePath,
  readFromFile,
} from "./file-utils";

import { CommentType } from "../comment-type";

/**
 * Handles messages received from the webview panel or webview view.
 * @param {any} message - The message received from the webview.
 */
export function handleMessageFromWebview(message: any) {
  switch (message.command) {
    case "addComment":
      const commentText = message.data.text;
      const fileName = getRelativePath();
      const title = message.data.title;
      addComment(fileName, activeEditor.selection, title, commentText);
      deactivate();
      break;
    case "deleteComment":
      const { id: commentId } = message;
      deleteComment(commentId);
      break;
    case "updateComment":
      const newCommentId = message.data.id;
      const newTitle = message.data.title;
      const newCommentText = message.data.text;
      updateComment(newCommentId, newCommentText, newTitle);
      deactivate();
      break;
    case "draftStored":
      const commentsData = message.data;
      addGeneralComments(commentsData);
      break;
    default:
      deactivate();
      break; // Handle unknown command
  }
}

/**
 * Get comments for a specific file
 * @param {string} filePath - Relative path of the file.
 * @returns {Promise<CommentType[]>} - An array of CommentType objects.
 */
export async function getFileComments(
  filePath: string
): Promise<CommentType[]> {
  if (!activeEditor) {
    return [];
  }

  try {
    const fileName = getRelativePath();
    const fileData = await readFromFile(filePath);
    const existingComments = fileData.comments;
    return existingComments.filter(
      (comment: CommentType) => comment.fileName === fileName
    );
  } catch (error) {
    console.error(`Error getting comments: ${error}`);
    throw error;
  }
}

/**
 * Adds highlight and icon for comments.
 * @param {string} filePath - Path of active file.
 */
export async function showComments(filePath: string) {
  emptyDecoration(); // Empty arrays to avoid duplicate decoration when adding a new comment

  try {
    const fileComments = await getFileComments(filePath);
    if (fileComments.length > 0) {
      fileComments.forEach((comment: CommentType) => {
        const { start, end } = comment;
        const startPos = new Position(start.line - 1, start.character - 1);
        const endPos = new Position(end.line - 1, end.character - 1);
        const lineLength = activeEditor.document.lineAt(end.line - 1).text
          .length;
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
  } catch (error) {
    console.error(`Error showing comments: ${error}`);
  }
}

/**
 * Gets a comment based on
 * @param {Range | number} input - Range of clicked comment or ID of comment
 @returns {Promise<CommentType | undefined>} - A promise that resolves to the retrieved comment or undefined if not found.
 */
export async function getComment(
  input: Range | number
): Promise<CommentType | undefined> {
  const filePath = getFilePath(COMMENTS_FILE);
  const fileData = await readFromFile(filePath);
  const allComments = fileData.comments;
  let comment: CommentType | undefined;

  // Finds comment in JSON based on the clicked range
  if (input instanceof Range) {
    const range = input;
    comment = allComments.find(
      (c: CommentType) =>
        c.fileName === getRelativePath() &&
        c.start.line <= range.start.line + 1 &&
        c.end.line >= range.end.line + 1 &&
        c.start.character <= range.start.character + 1 &&
        c.end.character >= range.end.character + 1
    );
  } else if (typeof input === "number") {
    const commentId = input;
    comment = allComments.find((c: CommentType) => c.id === commentId);
  }
  return comment;
}

/**
 * Updates a comment with new content and title.
 * @param {number} id - ID of the comment to be updated.
 * @param {string} comment - New comment text.
 * @param {string} title - New title for the comment.
 */
export async function updateComment(
  id: number,
  comment: string,
  title: string
) {
  const jsonFilePath = getFilePath(COMMENTS_FILE);

  try {
    const fileData = await readFromFile(jsonFilePath);
    const existingComments = fileData.comments;
    const commentIndex = existingComments.findIndex(
      (comment: CommentType) => comment.id === id
    );

    if (commentIndex !== -1) {
      const existingComment = existingComments[commentIndex];

      // Only update if comment or title has changed
      if (
        existingComment.comment !== comment ||
        existingComment.title !== title
      ) {
        existingComment.comment = comment;
        existingComment.title = title;
        const updatedData = { comments: existingComments };
        fs.promises.writeFile(jsonFilePath, JSON.stringify(updatedData));
        treeDataProvider.refresh();
        window.showInformationMessage("Comment successfully updated.");
      }
    }
  } catch (error) {
    window.showErrorMessage(`Error updating file: ${error}`);
    return;
  }
}

/**
 * Deletes a comment by its ID.
 * @param {number} id - ID of the comment to be deleted.
 */
export function deleteComment(id: number) {
  const jsonFilePath = getFilePath(COMMENTS_FILE);

  if (!jsonFilePath) {
    window.showErrorMessage("File not found");
    return;
  }

  try {
    window
      .showWarningMessage(
        "Are you sure you want to delete this comment? This cannot be undone.",
        ...["Yes", "No"]
      )
      .then(async (answer) => {
        if (answer === "Yes") {
          deactivate();
          window.showInformationMessage("Comment successfully deleted.");
        }

        const fileData = await readFromFile(jsonFilePath);
        const existingComments = fileData.comments;
        const commentIndex = existingComments.findIndex(
          (comment: CommentType) => comment.id === id
        );

        if (commentIndex !== -1) {
          existingComments.splice(commentIndex, 1);
          const updatedData = { comments: existingComments };
          fs.promises.writeFile(jsonFilePath, JSON.stringify(updatedData));
          treeDataProvider.refresh();
        }
      });
  } catch (error) {
    window.showErrorMessage(`Error deleting from file: ${error}`);
    return;
  }
}
