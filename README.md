# ✏️ Reviewify

Reviewify is a Visual Studio Code extension that enables users to perform code reviews by writing inline and general comments directly in the editor.

## Table of Contents
- [Inline Comments](#inline-comments)
  - [Add a New Inline Comment](#add-a-new-inline-comment)
  - [Editing Inline Comments](#editing-inline-comments)
    - [Update Inline Comment](#update-inline-comment)
    - [Delete Inline Comment](#delete-inline-comment)
  - [Overview of All Inline Comments](#overview-of-all-inline-comments)
- [General Comments](#general-comments)
- [Submit Review](#submit-review)


## Inline Comments

Inline comments are helpful for directly linking your comment with the relevant lines of code. The corresponding code line(s) will receive a purple background and feature a small comment icon at the end.

### Add a New Inline Comment

1. Highlight the code line(s) you want to comment on.
2. Right-click and select _✏️ Reviewify: Add Inline Comment_.
<img width="1002" alt="reviewfy_add_inline_comment" src="https://github.com/ingrihn/code-review/assets/54809082/d431705c-5657-4895-8b48-793a50b3ef7b">

3. A panel will appear to the right. Insert a title and a comment.
<img width="1147" alt="reviewify_webview_panel1" src="https://github.com/ingrihn/code-review/assets/54809082/8965d9a0-9feb-488a-95bd-6a6495e9f7d0">

4. Click on the _Save_ button (red circle in the picture) on the right when you are satisfied.
<img width="1144" alt="reviewify_panel2" src="https://github.com/ingrihn/code-review/assets/54809082/9d4ce3bc-09b1-48a3-8e96-51fe9b0c2b8a">

This is how it will look in the editor when the inline comment is added.
<img width="1140" alt="reviewify_inline_comment_sucessfully_added" src="https://github.com/ingrihn/code-review/assets/54809082/00794375-0d64-4a7c-a43a-48d522936a73">


### Editing Inline Comments

Click on the purple background to open the panel to the right with the comment and view the options for updating or deleting the comment.

#### Update Inline Comment
Edit the comment as desired. Click on the _Update_ button (red circle in the picture):
<img width="1143" alt="reviewify_update_inline_comment" src="https://github.com/ingrihn/code-review/assets/54809082/63b6ca47-d1d8-443d-aee6-21f6cead2a7d">

The comment will be updated accordingly.
<img width="1143" alt="reviewify_sucessful_update" src="https://github.com/ingrihn/code-review/assets/54809082/48aa744e-c457-4cea-9644-960d9e0fa5ba">

#### Delete Inline Comment
Click on the _Delete_ button (red circle). Confirm your choice by clicking on _Yes_ (blue circle).
<img width="1140" alt="reviewify_delete_comment" src="https://github.com/ingrihn/code-review/assets/54809082/84fe9fd6-afa9-475b-be19-b436fcc5b644">

The comment will be removed from the editor.
<img width="1144" alt="reviewify_delete_sucessful" src="https://github.com/ingrihn/code-review/assets/54809082/2d8098fa-61a9-400d-bc2f-69355c59b8b2">

### Overview of All Inline Comments
All inline comments are conveniently listed in one place for easier management. They are sorted by file and in descending priority order.

1. Either click on an inline comment or add a new one to show the panel on the right.
2. Click on the _Show all inline comments_ button (red circle).
<img width="1143" alt="reviewify_show_all_inline_comments" src="https://github.com/ingrihn/code-review/assets/54809082/57ef28d7-ed26-422e-b4e0-4cdd50b75b05">

3. A new tab will open at the bottom of the page. Click on one of the file names to open all of the comments for that file.
<img width="1115" alt="reviewify_overview_inline_comments" src="https://github.com/ingrihn/code-review/assets/54809082/b48f9d95-5802-41a4-bb01-b8b25c6e0454">


4. Click on a comment to navigate to its location in the code and display it in the panel. Make changes if desired.

## General Comments
To address issues that touch upon several files and themes, users can add general comments based on rubrics defined by instructors. Ensure that the `rubrics.json` is at the root level so that the extension can automatically display them.

1. Click on the _Reviewify_ icon to the left (red circle).
<img width="1216" alt="reviewify_icon_activity_bar" src="https://github.com/ingrihn/code-review/assets/54809082/2471b012-72f5-4f21-9d55-5f768a785e37">

2. Write a comment for each rubric. Add a score if desired. Both will be saved continuously.
<img width="1171" alt="Screenshot 2024-06-17 at 14 49 11" src="https://github.com/ingrihn/code-review/assets/54809082/0d165e55-b8e7-4211-b961-e7498eac0110">


## Submit Review

Once finished, the user can submit the score. Click on _Submit review_ from the general comments view or in the status bar at the bottom.

<img width="1178" alt="Screenshot 2024-06-17 at 14 50 26" src="https://github.com/ingrihn/code-review/assets/54809082/502fe70f-7d44-4959-b38b-903db8f510e0">
