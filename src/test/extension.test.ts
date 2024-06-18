import * as assert from "assert";
import * as fs from "fs";

import { afterEach, beforeEach } from "mocha";

import { InlineComment } from "../comment";
import path from "path";
import { readFromFile } from "../utils/file-utils";

suite("Inline comment tests", () => {
  const jsonFilePath = path.normalize("inline-comments.json");
  let comment1: InlineComment;

  // Deletes the JSON file after each test
  afterEach(() => {
    if (fs.existsSync(jsonFilePath)) {
      fs.unlinkSync(jsonFilePath);
    }
  });

  // Checks that array of inline comments is empty
  beforeEach(async () => {
    const emptyJsonContent = JSON.stringify({ inlineComments: [] });
    await fs.promises.writeFile(jsonFilePath, emptyJsonContent);
    const fileData = await readFromFile(jsonFilePath);
    const comments = fileData.inlineComments;
    assert.strictEqual(
      comments.length,
      0,
      "The comments array should be empty initially."
    );

    comment1 = {
      id: 1,
      fileName: "file1.ts",
      start: { line: 1, character: 0 },
      end: { line: 1, character: 10 },
      title: "Reusability",
      comment: "Be more modular",
      priority: 1,
    };
  });

  test("Add new inline comments", async () => {
    const jsonFileWithOneComment = JSON.stringify({
      inlineComments: [comment1],
    });
    await fs.promises.writeFile(jsonFilePath, jsonFileWithOneComment);
    let fileData = await readFromFile(jsonFilePath);
    let comments = fileData.inlineComments;

    assert.strictEqual(
      comments.length,
      1,
      "There should only be one comment in the file."
    );
    assert.deepStrictEqual(
      comments[0],
      comment1,
      "The first comment should match the added comment."
    );

    const comment2: InlineComment = {
      id: 2,
      fileName: "file1.ts",
      start: {
        line: 2,
        character: 0,
      },
      end: {
        line: 10,
        character: 20,
      },
      title: "For-loop",
      comment: "Should be improved for better performance",
      priority: 3,
    };
    const jsonFileWithTwoComments = JSON.stringify({
      inlineComments: [comment1, comment2],
    });
    await fs.promises.writeFile(jsonFilePath, jsonFileWithTwoComments);
    fileData = await readFromFile(jsonFilePath);
    comments = fileData.inlineComments;

    assert.strictEqual(
      comments.length,
      2,
      "There should be two comments in the file."
    );
    assert.deepStrictEqual(
      comments[0],
      comment1,
      "The first comment should match the added comment."
    );
    assert.deepStrictEqual(
      comments[1],
      comment2,
      "The second comment should match the added comment."
    );
  });

  test("Delete an inline comment", async () => {
    const fileWithOneComment = JSON.stringify({ inlineComments: [comment1] });
    await fs.promises.writeFile(jsonFilePath, fileWithOneComment);
    let fileData = await readFromFile(jsonFilePath);
    let comments = fileData.inlineComments;

    const commentIndex = comments.findIndex(
      (comment: InlineComment) => comment.id === comment1.id
    );
    if (commentIndex !== -1) {
      comments.splice(commentIndex, 1);
      const updatedJsonContent = { inlineComments: comments };
      await fs.promises.writeFile(
        jsonFilePath,
        JSON.stringify(updatedJsonContent)
      );
    }

    fileData = await readFromFile(jsonFilePath);
    comments = fileData.inlineComments;
    assert.strictEqual(
      comments.length,
      0,
      "The comments array should be empty after deleting the comment."
    );
  });
});
