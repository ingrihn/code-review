import * as fs from "fs";

import {
  GENERAL_COMMENTS_FILE,
  INLINE_COMMENTS_FILE,
  activeEditor,
  deactivate,
  treeDataProvider,
} from "../extension";
import { GeneralComment, InlineComment } from "../comment";
import { Selection, Uri, window, workspace } from "vscode";

import path from "path";
import { convertToGeneralComment, getCommentFromRubric } from "./comment-utils";

/**
 * Reads contents of a given JSON file
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<any>} The contents of the JSON file as a JavaScript object.
 */
export async function readFromFile(filePath: string): Promise<any> {
  try {
    const data = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error: any) {
    console.error(`Error reading from file: ${error.message}`);
    return;
  }
}

/**
 * Saves a new inline comment in the JSON file
 * @param {string} fileName - The name of the file.
 * @param {Selection} selection - The highlighted code lines.
 * @param {string} title - The title of the comment.
 * @param {string} commentText - The text of the comment.
 */
export async function saveComment(
  fileName: string,
  selection: Selection,
  title: string,
  commentText: string
) {
  const jsonFilePath = getFilePath(INLINE_COMMENTS_FILE);

  try {
    if (title.trim() || commentText.trim()) {
      const commentData: InlineComment = {
        id: Date.now(),
        fileName: fileName,
        start: {
          line: selection.start.line + 1,
          character: selection.start.character + 1,
        },
        end: {
          line: selection.end.line + 1,
          character: selection.end.character + 1,
        },
        title: title,
        comment: commentText,
      };

      const fileData = await readFromFile(jsonFilePath);
      const existingComments = fileData.inlineComments;
      existingComments.push(commentData);

      const updatedData = { inlineComments: existingComments };
      const commentsJson = JSON.stringify(updatedData);

      await fs.promises.writeFile(jsonFilePath, commentsJson);
      window.showInformationMessage("Comment successfully added.");
      treeDataProvider.refresh();
      deactivate();
    } else {
      window.showInformationMessage(
        "Please enter either a title or a comment."
      );
    }
  } catch (error: any) {
    window.showErrorMessage(`Error saving to file: ${error.message}`);
    return;
  }
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
  const jsonFilePath = getFilePath(INLINE_COMMENTS_FILE);

  try {
    const fileData = await readFromFile(jsonFilePath);
    const existingComments = fileData.inlineComments;
    const commentIndex = existingComments.findIndex(
      (comment: InlineComment) => comment.id === id
    );

    if (commentIndex !== -1) {
      const existingComment = existingComments[commentIndex];

      // Only update if comment or title has changed. and both title and comment cannot be empty
      if (
        comment.trim() &&
        title.trim() &&
        (existingComment.comment !== comment || existingComment.title !== title)
      ) {
        existingComment.comment = comment;
        existingComment.title = title;
        const updatedData = { inlineComments: existingComments };
        fs.promises.writeFile(jsonFilePath, JSON.stringify(updatedData));
        treeDataProvider.refresh();
        deactivate();
        window.showInformationMessage("Comment successfully updated.");
      } else {
        window.showInformationMessage(
          "Either no changes detected, or missing title or comment."
        );
      }
    }
  } catch (error) {
    window.showErrorMessage(`Error updating: ${error}`);
    return;
  }
}

/**
 * Deletes a comment by its ID.
 * @param {number} id - ID of the comment to be deleted.
 */
export function deleteComment(id: number) {
  const jsonFilePath = getFilePath(INLINE_COMMENTS_FILE);

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
          const fileData = await readFromFile(jsonFilePath);
          const existingComments = fileData.inlineComments;
          const commentIndex = existingComments.findIndex(
            (comment: InlineComment) => comment.id === id
          );

          if (commentIndex !== -1) {
            existingComments.splice(commentIndex, 1);
            const updatedData = { inlineComments: existingComments };
            fs.promises.writeFile(jsonFilePath, JSON.stringify(updatedData));
            treeDataProvider.refresh();
          }

          deactivate();
          window.showInformationMessage("Comment successfully deleted.");
        }
      });
  } catch (error) {
    window.showErrorMessage(`Error deleting from file: ${error}`);
    return;
  }
}

/**
 * Saves a list of general comments in general-comments.json
 * @param {{ comment: string; score?: number; rubricId: number }[]} generalComments The comments to save.
 */
async function saveGeneralComments(
  generalComments: { comment: string; score?: number; rubricId: number }[]
) {
  const jsonFilePath = getFilePath(GENERAL_COMMENTS_FILE);
  try {
    const commentsToSave: GeneralComment[] = convertToGeneralComment(generalComments);
    const updatedData = { generalComments: commentsToSave };
    const generalCommentsJson = JSON.stringify(updatedData);
    await fs.promises.writeFile(jsonFilePath, generalCommentsJson);

  } catch (error: any) {
    window.showErrorMessage(`Error saving to file: ${error.message}`);
    return;
  }
}

/**
 * Saves a new draft of general comments in a JSON file
 * @param {{ comment: string; score?: number; rubricId: number }[]} generalComments The comments to save.
 */
export async function saveDraft(generalComments: { comment: string; score?: number; rubricId: number }[]) {
  saveGeneralComments(generalComments);
}

/**
 * Submits the entire review
 * @param {{ comment: string; score?: number; rubricId: number }[]} generalComments The comments to submit.
 */
export async function submitReview(generalComments: { comment: string; score?: number; rubricId: number }[]) {
  try {
    saveGeneralComments(generalComments);
    const rubricsData = await readFromFile(getFilePath("rubrics.json"));
    const rubrics = Array.from(rubricsData.rubrics);
    let emptyRubric = false;
    await Promise.all(rubrics.map(async (rubric: any) => {
      let rubricId = Number(rubric.id);
      const comment = await getCommentFromRubric(rubricId);
      if (comment === undefined) {
          emptyRubric = true;
          window.showErrorMessage("You have not written a comment and/or given a score for some of the general comment rubrics. To fill in these, select the CollabRate icon in the activity bar on the far left.");
      }
    }));

    if (!emptyRubric) {
      window
      .showWarningMessage(
        "Are you sure you want to submit your review? This cannot be undone.",
        ...["Yes", "No"]
      )
      .then(async (answer) => {
        if (answer === "Yes") {
          deactivate();
          window.showInformationMessage("Review successfully submitted.");
        }
      });
    }

  } catch (error) {
    window.showErrorMessage(`Error submitting review: ${error}`);
    return;
  }
  
}

/**
 * Get URi of the working directory in the editor that runs the extension
 * @returns {Uri} The URI of the workspace folder.
 */
export function getWorkspaceFolderUri(): Uri {
  const workspaceFolder = workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("No workspace folder found.");
  }
  return workspaceFolder.uri;
}

/**
 * Gets the relative path of the active file in the workspace
 * @returns {string} Relative path.
 */
export function getRelativePath(): string {
  const absoluteFilePath = activeEditor.document.fileName;
  const projectRoot = getWorkspaceFolderUri().fsPath;
  return path.relative(projectRoot, absoluteFilePath);
}

/**
 * Gets absolute path of a file within the workspace by its file name
 * @param {string} fileName - Name of the file.
 * @returns {string} Absolute path.
 */
export function getFilePath(fileName: string): string {
  return path.join(getWorkspaceFolderUri().fsPath, fileName);
}

/**
 * Checks if file exists, makes it it if doesn't
 * @param {string} filePath - Relative path of file.
 * @param {string} arrayName - Name of initial array in JSON file.
 */
export function checkIfFileExists(
  filePath: string,
  arrayName: string
): boolean {
  if (fs.existsSync(filePath)) {
    return true;
  } else {
    fs.promises.writeFile(filePath, `{"${arrayName}": []}`);
    return false;
  }
}
