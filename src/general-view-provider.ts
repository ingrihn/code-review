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
      webviewView.webview.html = data.replace("${cssPath}", cssUri.toString());
      webviewView.webview.postMessage({
        command: "rubricsJson",
        data: rubricsJson,
      });
      setTimeout(() => {
        webviewView.webview.postMessage({
          command: "rubricsJson",
          data: rubricsJson,
        });
        console.log("Message sent");
      }, 3500);
    } catch (error) {
      console.error("Error resolving webview view:", error);
    }
  }
}
