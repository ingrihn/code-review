import {
  GENERAL_COMMENTS_FILE,
  INLINE_COMMENTS_FILE,
  activeEditor,
  emptyDecoration,
  highlight,
  highlightDecoration,
  icon,
  iconDecoration,
} from "../extension";
import { GeneralComment, InlineComment } from "../comment";
import { Position, Range, window } from "vscode";
import { getFilePath, getRelativePath, readFromFile } from "./file-utils";

/**
 * Get comments for a specific file.
 * @param {string} filePath - Relative path of the file.
 * @returns {Promise<InlineComment[]>} - An array of InlineComment objects.
 */
export async function getFileComments(
  filePath: string
): Promise<InlineComment[]> {
  if (!activeEditor) {
    return [];
  }

  try {
    const fileName = getRelativePath();
    const fileData = await readFromFile(filePath);
    const existingComments = fileData.inlineComments;
    return existingComments.filter(
      (comment: InlineComment) => comment.fileName === fileName
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
    fileComments.forEach((comment: InlineComment) => {
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
  } catch (error) {
    console.error(`Error showing comments: ${error}`);
  }
}

/**
 * Gets a comment based on clicked range or ID
 * @param {Range | number} input - Range of clicked comment or ID of comment.
 * @returns {Promise<InlineComment | undefined>} - A promise that resolves to the retrieved comment or undefined if not found.
 */
export async function getComment(
  input: Range | number
): Promise<InlineComment | undefined> {
  const filePath = getFilePath(INLINE_COMMENTS_FILE);
  const fileData = await readFromFile(filePath);
  const allComments = fileData.inlineComments;
  let comment: InlineComment | undefined;

  // Finds comment in JSON based on the clicked range
  if (input instanceof Range) {
    const range = input;
    comment = allComments.find(
      (c: InlineComment) =>
        c.fileName === getRelativePath() &&
        c.start.line <= range.start.line + 1 &&
        c.end.line >= range.end.line + 1 &&
        c.start.character <= range.start.character + 1 &&
        c.end.character >= range.end.character + 1
    );
  } else if (typeof input === "number") {
    const commentId = input;
    comment = allComments.find((c: InlineComment) => c.id === commentId);
  }
  return comment;
}

/**
 * Gets all general comments saved in the JSON file
 * @returns {Promise<GeneralComment[]>} The saved comments
 */
export async function getGeneralComments(): Promise<GeneralComment[]> {
  const fileData = await readFromFile(getFilePath(GENERAL_COMMENTS_FILE));
  const savedComments = fileData.generalComments;
  return savedComments;
}

/**
 * Gets the general comment associated with a specified rubric
 * @param {Number} rubricId The id of the rubric
 * @returns {Promise<GeneralComment | undefined>} The general comment for the specified rubric, or undefined if no such comment exists
 */
export async function getCommentFromRubric(
  rubricId: Number
): Promise<GeneralComment | undefined> {
  const savedComments = await getGeneralComments();
  let comment = undefined;
  if (savedComments.length > 0) {
    comment = savedComments.find(
      (generalComment: { comment: string; rubricId: number; score?: number }) =>
        generalComment.rubricId === rubricId
    );
  }
  return comment;
}

/**
 * Converts a list of objects with the attributes comment, score and rubricId to a list of GeneralComment objects
 * @param {{ comment: string; score?: number; rubricId: number }[]} generalComments The list of objects to convert
 * @returns {GeneralComment[]} A list of GeneralComment objects
 */
export function convertToGeneralComment(
  generalComments: { comment: string; score?: number; rubricId: number }[]
): GeneralComment[] {
  const commentsToSave: GeneralComment[] = [];

  if (generalComments !== undefined) {
    generalComments.forEach((generalComment) => {
      if (generalComment.comment !== "" || generalComment.score !== undefined) {
        const generalCommentData: GeneralComment = {
          comment: generalComment.comment,
          score: generalComment.score,
          rubricId: generalComment.rubricId,
        };
        commentsToSave.push(generalCommentData);
      }
    });
  }
  return commentsToSave;
}

/**
 * Converts a list of GeneralComment objects to a list of objects with the attributes comment, score and rubridId
 * @param {GeneralComment[]} generalComments The list of GeneralComment objects to convert
 * @returns {{ comment: string; score?: number; rubricId: number }[]} A list of objects with the attributes comment, score and rubricId
 */
export function convertFromGeneralComment(
  generalComments: GeneralComment[]
): { comment: string; score?: number; rubricId: number }[] {
  const commentsToSave: {
    comment: string;
    score?: number;
    rubricId: number;
  }[] = [];

  if (generalComments !== undefined) {
    generalComments.forEach((generalComment) => {
      if (generalComment.comment !== "" || generalComment.score !== undefined) {
        const generalCommentData: {
          comment: string;
          score?: number;
          rubricId: number;
        } = {
          comment: generalComment.comment,
          score: generalComment.score,
          rubricId: generalComment.rubricId,
        };
        commentsToSave.push(generalCommentData);
      }
    });
  }
  return commentsToSave;
}
