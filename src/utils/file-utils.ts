import * as fs from "fs";

import {
  GENERAL_COMMENTS_FILE,
  INLINE_COMMENTS_FILE,
  activeEditor,
  disposePanel,
  treeDataProvider,
} from "../extension";
import { GeneralComment, InlineComment } from "../comment";
import { Selection, Uri, window, workspace } from "vscode";
import { convertToGeneralComment, getGeneralComment } from "./comment-utils";

import { GeneralViewProvider } from "../general-view-provider";
import path from "path";

/**
 * Reads content of a given JSON file.
 * @param {string} filePath - The path to the JSON file.
 * @returns {Promise<any>} - The content of the JSON file as a JavaScript object.
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
 * Saves a new inline comment in the INLINE_COMMENTS_FILE.
 * @param {string} fileName - The name of the file.
 * @param {Selection} selection - The highlighted code lines.
 * @param {string} title - The title of the inline comment.
 * @param {string} commentText - The text of the inline comment.
 * @param {number} priority - The priority of the inline comment.
 */
export async function saveInlineComment(
  fileName: string,
  selection: Selection,
  title: string,
  commentText: string,
  priority?: number
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

      // Only add priority if they have checked for it
      if (priority !== undefined) {
        commentData.priority = priority;
      }

      const fileData = await readFromFile(jsonFilePath);
      const existingComments = fileData.inlineComments;
      existingComments.push(commentData);

      const updatedData = { inlineComments: existingComments };
      const commentsJson = JSON.stringify(updatedData);

      await fs.promises.writeFile(jsonFilePath, commentsJson);
      window.showInformationMessage("Inline comment successfully added.");
      treeDataProvider.refresh();
      disposePanel();
    } else {
      window.showInformationMessage(
        "Please enter either a title or a comment text."
      );
    }
  } catch (error: any) {
    window.showErrorMessage(`Error saving to file: ${error.message}`);
    return;
  }
}

/**
 * Updates an inline comment in the INLINE_COMMENTS_FILE with new comment text, title, and/or priority.
 * @param {number} id - The ID of the comment to be updated.
 * @param {string} commentText - The new comment text.
 * @param {string} title - The new title for the comment.
 * @param {number} priority - The new priority for the comment.
 */
export async function updateComment(
  id: number,
  commentText: string,
  title: string,
  priority?: number
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
      // Only update if comment text, title or priority has changed. Both title and comment text cannot be empty.
      if (
        (commentText.trim() || title.trim()) &&
        (existingComment.comment !== commentText ||
          existingComment.title !== title ||
          existingComment.priority !== priority)
      ) {
        existingComment.comment = commentText;
        existingComment.title = title;
        existingComment.priority = priority;
        const updatedData = { inlineComments: existingComments };
        fs.promises.writeFile(jsonFilePath, JSON.stringify(updatedData));
        treeDataProvider.refresh();
        disposePanel();
        window.showInformationMessage("Inline comment successfully updated.");
      } else {
        window.showInformationMessage(
          "Either no changes detected, or missing title or comment text."
        );
      }
    }
  } catch (error) {
    window.showErrorMessage(`Error updating: ${error}`);
    return;
  }
}

/**
 * Deletes an inline comment from the INLINE_COMMENTS_FILE by its ID.
 * @param {number} id - The ID of the comment to be deleted.
 */
export function deleteInlineComment(id: number) {
  const jsonFilePath = getFilePath(INLINE_COMMENTS_FILE);

  if (!jsonFilePath) {
    window.showErrorMessage("File not found");
    return;
  }

  try {
    window
      .showWarningMessage(
        "Are you sure you want to delete this inline comment? This cannot be undone.",
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

          disposePanel();
          window.showInformationMessage("Inline comment successfully deleted.");
        }
      });
  } catch (error) {
    window.showErrorMessage(
      `Error deleting inline comment from file: ${error}`
    );
    return;
  }
}

/**
 * Saves a list of general comments in the GENERAL_COMMENTS_FILE.
 * @param {{ comment: string; score?: number; rubricId: number }[]} generalComments - The general comments to save.
 */
async function saveGeneralComments(
  generalComments: { comment: string; score?: number; rubricId: number }[]
) {
  const jsonFilePath = getFilePath(GENERAL_COMMENTS_FILE);
  try {
    const commentsToSave: GeneralComment[] =
      convertToGeneralComment(generalComments);
    const updatedData = { generalComments: commentsToSave };
    const generalCommentsJson = JSON.stringify(updatedData);
    await fs.promises.writeFile(jsonFilePath, generalCommentsJson);
  } catch (error: any) {
    window.showErrorMessage(
      `Error saving general comments to file: ${error.message}`
    );
    return;
  }
}

/**
 * Saves a new draft of general comments in the GENERAL_COMMENTS_FILE.
 * @param {{ comment: string; score?: number; rubricId: number }[]} generalComments - The general comments to save as draft.
 */
export async function saveDraft(
  generalComments: { comment: string; score?: number; rubricId: number }[]
) {
  saveGeneralComments(generalComments);
}

/**
 * Submits the entire review with all inline and general comments.
 * @param {{ comment: string; score?: number; rubricId: number }[]} generalComments - The general comments to submit.
 * @param {GeneralViewProvider} generalViewProvider - The provider of the webview view for general comments.
 */
export async function submitReview(
  generalComments: { comment: string; score?: number; rubricId: number }[],
  generalViewProvider: GeneralViewProvider
) {
  try {
    saveGeneralComments(generalComments);
    const rubricsData = await readFromFile(
      getFilePath("review-guidelines.json")
    );
    const rubrics = Array.from(rubricsData.reviewGuidelines);
    let emptyRubric = false;
    await Promise.all(
      rubrics.map(async (rubric: any) => {
        let rubricId = Number(rubric.id);
        const comment = await getGeneralComment(rubricId);
        if (comment === undefined) {
          emptyRubric = true;
          window.showErrorMessage(
            "You have not written a comment and/or given a score for some of the general comment rubrics. To fill in these, select the Reviewify icon in the activity bar on the far left."
          );
        }
      })
    );

    if (!emptyRubric) {
      window
        .showWarningMessage(
          "Are you sure you want to submit your review? This cannot be undone.",
          ...["Yes", "No"]
        )
        .then(async (answer) => {
          if (answer === "Yes") {
            // TODO: Add logic for submitting both inline and general comments
            generalViewProvider.setDisplayRubrics(false);
            disposePanel();
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
 * Gets the URI of the working directory in the editor that runs the extension.
 * @returns {Uri} - The URI of the workspace folder.
 * @throws {ErrorConstructor}
 */
export function getWorkspaceFolderUri(): Uri {
  const workspaceFolder = workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    throw new Error("No workspace folder found.");
  }
  return workspaceFolder.uri;
}

/**
 * Gets the relative path of the active file in the workspace.
 * @returns {string} - The relative path of the active file.
 */
export function getRelativePath(): string {
  const absoluteFilePath = activeEditor.document.fileName;
  const projectRoot = getWorkspaceFolderUri().fsPath;
  return path.relative(projectRoot, absoluteFilePath);
}

/**
 * Gets the absolute path of a file within the workspace by its file name.
 * @param {string} fileName - The name of the file.
 * @returns {string} - The absolute path of the file.
 */
export function getFilePath(fileName: string): string {
  return path.join(getWorkspaceFolderUri().fsPath, fileName);
}

/**
 * Checks if a file exists, makes it if it does not
 * @param {string} filePath - The relative path of a file.
 * @param {string} arrayName - The name of the array in a JSON file.
 * @returns {boolean} - Returns true if the file exists, false if it was created.
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
