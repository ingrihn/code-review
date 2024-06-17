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
- [For Instructors: Defining Reviewing Criteria](#for-instructors-defining-reviewing-criteria)


## Inline Comments

Inline comments are helpful for directly linking your comment with the relevant lines of code. The corresponding code line(s) will receive a purple background and feature a small comment icon at the end.

### Add a New Inline Comment

1. Highlight the code line(s) you want to comment on.
2. Right-click and select _✏️ Reviewify: Add Inline Comment_.
<img width="1002" alt="reviewfy_add_inline_comment" src="https://github.com/ingrihn/code-review/assets/54809082/d431705c-5657-4895-8b48-793a50b3ef7b">

3. A panel will appear to the right. Insert a title and a comment.

4. Click on the _Save_ button (red circle) on the right when you are satisfied.
<img width="1144" alt="reviewify_panel2" src="https://github.com/ingrihn/code-review/assets/54809082/9d4ce3bc-09b1-48a3-8e96-51fe9b0c2b8a">

This is how it will look in the editor when the inline comment is added.
<img width="1140" alt="reviewify_inline_comment_sucessfully_added" src="https://github.com/ingrihn/code-review/assets/54809082/00794375-0d64-4a7c-a43a-48d522936a73">


### Editing Inline Comments

Click on the purple background to open the panel to the right with the comment and view the options for updating or deleting the comment.

#### Update Inline Comment
Edit the comment as desired. Click on the _Update_ button (red circle in the picture). The comment will be updated accordingly.
<img width="1143" alt="reviewify_update_inline_comment" src="https://github.com/ingrihn/code-review/assets/54809082/63b6ca47-d1d8-443d-aee6-21f6cead2a7d">

#### Delete Inline Comment
Click on the _Delete_ button (red circle). Confirm your choice by clicking on _Yes_ (blue circle). The comment will be removed from the editor.
<img width="1140" alt="reviewify_delete_comment" src="https://github.com/ingrihn/code-review/assets/54809082/84fe9fd6-afa9-475b-be19-b436fcc5b644">

### Overview of All Inline Comments
All inline comments are conveniently listed in one place for easier management. This overview automatically appears in the panel at the bottom of the screen when the extension is activated, under the tab labeled _Inline comments_. Comments are sorted by file and in descending priority order. Clicking on a file name will show all comments related to that file. Furthermore, clicking on any comment navigates to its location in the code and displays its values in the panel on the right. 

The overview can be minimised if desired. To reopen it, you can either click on _Terminal -> New Terminal_ and select the _Inline comments_ tab or navigate through an inline comment:

1. Click on an inline comment or add a new one to show the panel on the right.
2. Click on the _Show all inline comments_ button (red circle).
3. The panel at the bottom, including the _Inline comments_ tab, will show up.
<img width="1225" alt="Screenshot 2024-06-17 at 15 38 43" src="https://github.com/ingrihn/code-review/assets/54809082/3e10cce6-3aed-4272-9690-e954bd3ff3ed">

## General Comments
To address issues that touch upon several files and themes, users can add general comments based on rubrics defined by instructors.

1. Fill `rubrics.json` with the appropriate rubrics provided by your instructor.
2. Click on the _Reviewify_ icon to the left (red circle).
3. Write a comment for each rubric. Add a score if desired. Both will be saved continuously.
<img width="1171" alt="Screenshot 2024-06-17 at 14 49 11" src="https://github.com/ingrihn/code-review/assets/54809082/79b62528-35e2-4ca9-82dd-0012ddb35c4e">

## Submit Review
Once finished, the user can submit the entire review. Click on _Submit review_ from the general comments view or in the status bar at the bottom (red circle). Confirm by clicking on "Yes" (blue circle).

<img width="1178" alt="Screenshot 2024-06-17 at 14 50 26" src="https://github.com/ingrihn/code-review/assets/54809082/ffed99b3-36a2-49e9-801a-d3e0203093c1">

You will get a message that the code review is submitted.
<img width="1017" alt="Screenshot 2024-06-17 at 15 21 20" src="https://github.com/ingrihn/code-review/assets/54809082/a782552e-3afe-4e0f-bf37-e2b54ceb26a2">

## For Instructors: Defining Reviewing Criteria
As mentioned, instructors must provide the desired rubrics in `rubrics.json` before the user can fill in general comments. Each rubric includes a prompt that users can answer with text and an optional Likert-score. These rubrics must be written in the following format:

```json
{
    "rubrics": [
        {
            "id": 1,
            "title": "How would you assess the code quality of the project?",
            "description": "Here you can consider criteria such as readability, maintainability, efficiency, and adherence to best practices.",
            "has_score": "true"
        },
        {
            "id": 2,
            "title": "How would you assess the software architecture?",
            "description": "Here you can consider criteria such as scalability, modularity, flexibility, and adherence to architectural principles.",
            "has_score": "false"
        }
    ]
}
```

