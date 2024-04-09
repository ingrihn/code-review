import * as fs from "fs";

import {
  CancellationToken,
  Uri,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { getFilePath, readFromFile } from "./utils/file-utils";

export class GeneralViewProvider implements WebviewViewProvider {
  public static readonly viewType = "collabrate-general";
  private _view?: WebviewView;
  private _extensionUri: Uri;

  constructor(extensionUri: Uri) {
    this._extensionUri = extensionUri;
  }

  public getView(): WebviewView | undefined {
    return this._view;
  }

  public async resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    _token: CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
    };

    const cssUri = webviewView.webview.asWebviewUri(
      Uri.joinPath(this._extensionUri, "src", "style.css")
    );
    const htmlFilePath = Uri.joinPath(
      this._extensionUri,
      "src",
      "general-comments.html"
    );

    try {
      const [data, rubricsJson] = await Promise.all([
        fs.promises.readFile(htmlFilePath.fsPath, "utf-8"),
        readFromFile(getFilePath("rubrics.json")),
      ]);

      let rubricHtml = await this.loadHtml(rubricsJson);

      //Sets the CSS and load the HTML for the rubrics into the webview view
      let htmlContent = data
        .replace("${cssPath}", cssUri.toString())
        .replace("${rubrics}", rubricHtml);

      webviewView.webview.html = htmlContent;
    } catch (error) {
      console.error("Error resolving webview view:", error);
    }
  }

  /**
   * Creates the HTML for the rubrics associated with the general comments.
   * @param {any} rubrics The list of rubric objects.
   * @returns {Promise<string>} The HTML for the rubrics.
   */
  private async loadHtml(rubrics: any): Promise<string> {
    let content = "";
    const fileData = await readFromFile(getFilePath("general-comments.json"));
    const savedComments = fileData.generalComments;
    rubrics.rubrics = Array.from(rubrics.rubrics);

    rubrics.rubrics.forEach((rubric: any) => {
      let rubricId = Number(rubric.id);
      let commentText = "";
      let score = undefined;

      if (savedComments.length > 0) {
        let savedComment = savedComments.find(
          (generalComment: {
            id: number;
            comment: string;
            rubricId: number;
            score?: number;
          }) => generalComment.rubricId === rubricId
        );
        commentText = savedComment.comment;
        score = savedComment.score;
      }

      content += `<div class="rubric" data-rubric-id="${rubricId}">
      <h4 id="rubricTitle">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          fill="currentColor"
          class="bi bi-search"
          viewBox="0 0 16 16"
        >
          <path
            d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0"
          />
        </svg>
        ${rubric.title}
      </h4>
      <p id="rubricDescription">
        ${rubric.description}
      </p>
      <textarea
        class="commentBox"
        placeholder="Skriv her."
        cols="40"
        rows="4"
      >${commentText}</textarea
      ><br />
      `;
      if (rubric.has_score === "true") {
        content += `<div class="flex-container">
        <div class="radio-button-group">`;
        for (let i = 1; i <= 5; i++) {
          content += `<label class="container"
          >${i}`;
          if (score === i) {
            content += `<input class="radio-button" type="radio" name="radio-${rubric.id}" checked />`;
          } else {
            content += `<input class="radio-button" type="radio" name="radio-${rubric.id}" />`;
          }
          content += `<span class="checkmark"></span>
          </label>`;
        }
        content += `</div></div>`;
      }
      content += `</div>
      <br />`;
    });
    return content;
  }
}