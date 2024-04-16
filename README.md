# ✏️ CollabRate

CollabRate is a Visual Studio Code extension that enables users to perform code reviews by writing inline and general comments directly in the editor. By co-locating these functions, we streamline the feedback process and provide a seamless experience.

## Startup

1. Download the repository.
2. Open the folder in Visual Studio Code.
3. Start the extension by pressing _F5_ or clicking on the _Run Extension_ button.

This will open a new editor where you can select the project you wish to review.

## Inline comments

Inline comments are helpuful for directly linking your comment with the relevant lines of code.

1. Highlight the code line(s) you want to comment on.
2. Right-click and select _✏️ CollabRate: Add Comment_.
3. A webview panel will appear to the right. Insert a title and a comment.
4. Click on _Save_ when you are satisfied.

![Skjermbilde 2024-04-11 kl  14 13 57](https://github.com/ingrihn/code-review/assets/54781143/34ef783b-353d-471d-b416-297106c69380)

![Skjermbilde 2024-04-11 kl  14 16 00](https://github.com/ingrihn/code-review/assets/54781143/03fabd59-e196-4e38-bbe5-7e47958e9315)

The corresponding code line(s) will receive a teal background and feature a small comment icon at the end. All inline comments are stored in `inline-comments.json`.

### Editing inline comments (update and delete)

Click within the highlighted range, and the webview panel will open to the right, displaying the title and comment. Edit or delete the comment as needed. The file will be updated accordingly.


### Overview of all inline comments

All inline comments are conveniently listed in one place for easier management.

1. Click on _CollabRate_ (comment icon) in the Activity Bar. A tree view will open to the bottom left and the inline comments will be grouped by file under _Inline comments_.
2. Click on a comment to open the corresponding file and navigate to the comment. The comment will also be shown in the webview panel to the right.

![Skjermbilde 2024-04-16 kl  10 13 45](https://github.com/ingrihn/code-review/assets/54781143/af69a258-2a07-467c-9726-5366bd812d39)


## General comments

To address issues that touch upon several files/themes, users can add general comments based on pre-defined rubrics. Click on _CollabRate_ (comment icon) in the Activity Bar to open the webview view on the left under _General comments_.

![Skjermbilde 2024-04-16 kl  10 06 31](https://github.com/ingrihn/code-review/assets/54781143/d31a0dfc-d7b1-4740-b23b-99f653de9742)

Each rubric includes a prompt that users can answer with text and an optional Likert-score. The rubrics are retrieved from the file `rubrics.json`. This file must be updated with the desired rubrics before the user can fill in general comments. These rubrics must be written in the following format in `rubrics.json`:

```
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

To save what you have written so far, scroll to the bottom of the _General comments_ tab and click on _Save as draft._ Your comments will then be stored in `general-comments.json`. Note that only one draft can be saved at a time; any new drafts will overwrite the previous one. If you wish to complete your review, click on `Submit review`.
