# CollabRate

CollabRate is a Visual Studio Code extension that enables users to write inline and general comments directly in the editor. By co-locating these functions, we streamline the feedback process and provide a seamless experience.

## Startup

1. Download the repository.
2. Open the folder in Visual Studio Code.
3. Start the extension by pressing _F5_ or clicking on the _Run Extension_ button.

This will open a new editor where you can select the project you wish to review.

## Inline comments

Inline comments are helpuful for directly linking your comment with the relevant lines of code.

1. Highlight the code line(s) you want to comment on.
2. Right-click and select _CollabRate: Add Comment_.
3. A webview panel will appear to the right. Insert a title and a comment.
4. Click on _Add_ when you are satisfied.

The corresponding code line(s) will receive a teal background and feature a small comment icon at the end. All inline comments are stored in `inline-comments.json`and adhere to the format in `comment-type.ts`:

```
export interface InlineCommentType {
    id: number;
    fileName: string;
    start: {
      line: number;
      character: number;
    };
    end: {
      line: number;
      character: number;
    };
    title: string;
    comment: string;
  }
```

### Editing inline comments (update and delete)

Click within the highlighted range, and the webview panel will open to the right, displaying the title and comment. Edit or delete the comment as needed. The file will be updated accordingly.

### Overview of all inline comments

All inline comments are conveniently listed in one place for easier management.

1. Click on _CollabRate_ (comment icon) in the Activity Bar. A webviewview will open to the left and they will be grpuped by file under _Inline comments_.
2. Click on a comment to open the corresponding file in a new tab. The comment will also be shown in the webview panel to the right.

## General comments

To address issues that touch upon several files/themes, users can add general comments based on pre-defined rubrics. Click on _CollabRate_ (comment icon) in the Activity Bar to open the new panel on the left and see under _General comments_.

The rubrics are retrieved from `rubrics.json`. Each rubric includes a prompt that users can answer with text and an optional Likert-score.

```
export interface GeneralCommentType {
    title: string;
    description: string;
    has_score: boolean;
}
```

To save what you has written so far, scroll to the bottom og the _General comments_ tab and click on _Save as draft._ If you wish to complete your review, click on `Submit review`.
