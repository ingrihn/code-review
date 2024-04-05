import * as fs from "fs";

import { COMMENTS_FILE, activeEditor, treeDataProvider } from "../extension";
import { Selection, Uri, window, workspace } from "vscode";

import { CommentType } from "../comment-type";
import path from "path";

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
 * Saves new comment in the JSON file
 * @param {string} fileName - The name of the file.
 * @param {Selection} selection - The highlited code lines.
 * @param {string} title - The title of the comment.
 * @param {string} commentText - The text of the comment.
 */
export async function addComment(
  fileName: string,
  selection: Selection,
  title: string,
  commentText: string
) {
  const jsonFilePath = getFilePath(COMMENTS_FILE);

  try {
    const commentData: CommentType = {
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
    const existingComments = fileData.comments;
    existingComments.push(commentData);

    const updatedData = { comments: existingComments };
    const commentsJson = JSON.stringify(updatedData);

    await fs.promises.writeFile(jsonFilePath, commentsJson);
    window.showInformationMessage("Comment successfully added.");
    treeDataProvider.refresh();
  } catch (error: any) {
    window.showErrorMessage(`Error saving to file: ${error.message}`);
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
