import { ExtensionContext, Uri } from "vscode";

export let lowPriorityIconUri: Uri;
export let mediumPriorityIconUri: Uri;
export let highPriorityIconUri: Uri;

/**
 * Sets the URI for priority icons.
 * @param {ExtensionContext} context - The context in which the extension is running.
 */
export function initialiseIconUris(context: ExtensionContext) {
  const basePath = Uri.file(context.extensionUri.path + "/src/assets");
  lowPriorityIconUri = Uri.joinPath(basePath, "priority-low-icon.svg");
  mediumPriorityIconUri = Uri.joinPath(basePath, "priority-medium-icon.svg");
  highPriorityIconUri = Uri.joinPath(basePath, "priority-high-icon.svg");
}
