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

  getView(): WebviewView | undefined {
    return this._view;
  }
  
    public async resolveWebviewView(
          webviewView: WebviewView,
          context: WebviewViewResolveContext,
          _token: CancellationToken,
      ) {
          this._view = webviewView;
      
          webviewView.webview.options = {
              enableScripts: true,
          };

      const cssUri = webviewView.webview.asWebviewUri(Uri.joinPath(this._extensionUri, 'src', 'style.css'));
      const htmlFilePath = Uri.joinPath(
        this._extensionUri,
        "src",
        "general-comments.html"
      );

      

      // const webviewPath = path.resolve(__dirname, "../src/webview.html");
      // const cssPath = Uri.joinPath(context.extensionUri, "src", "custom.css");
      // const cssUri = panel.webview.asWebviewUri(cssPath);
      
      try {
        const [data, rubricsJson] = await Promise.all([
          fs.promises.readFile(htmlFilePath.fsPath, "utf-8"),
          readFromFile(getFilePath("rubrics.json"))
        ]);

        let rubricHtml = this.loadHtml(rubricsJson);

        let htmlContent = data
          .replace("${cssPath}", cssUri.toString())
          .replace("${rubrics}", rubricHtml);

        webviewView.webview.html = htmlContent;
        // webviewView.webview.postMessage({ command: 'rubricsJson', data: rubricsJson });
        // setTimeout(() => {
        //   console.log("test2");
        //   webviewView.webview.postMessage({ command: 'rubricsJson', data: rubricsJson });
        // }, 3500);
      
      } catch (error) {
          console.error('Error resolving webview view:', error);
      }
  }

  private loadHtml(rubrics: any): string {
    let content = "";
    rubrics.rubrics = Array.from(rubrics.rubrics);
    rubrics.rubrics.forEach((rubric: any) => {
    //const storedDraft = JSON.parse(localStorage.getItem(rubric.title));
      content += `<div class="rubric">
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
      ></textarea
      ><br />
      `;
      if (rubric.has_score === "true") {
        content += `<div class="flex-container">
        <div class="radio-button-group">`;
        for (let i = 1; i <= 5; i++) {
          content += `<label class="container"
          >${i}
          <input class="radio-button" type="radio" name="radio" />
          <span class="checkmark"></span>
        </label>`;
        }
        content += `</div></div>`;
      }
      content += `</div>
      <br />`;
    });
    return content;
    
  }
  

 
  // public setMessageReceived(messageReceived: boolean) {
  //   this.messageReceived = messageReceived;
  // }

  // public getMessageReceived(): boolean {
  //   return this.messageReceived;
  // }
}
