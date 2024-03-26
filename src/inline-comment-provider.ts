import { Event, EventEmitter, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from "vscode";
import { InlineComment } from "./inline-comment";
import { readFromFile } from "./extension";

export class InlineCommentProvider implements TreeDataProvider<InlineComment> {
    private _onDidChangeTreeData: EventEmitter<InlineComment | undefined> = new EventEmitter<InlineComment | undefined>();
    readonly onDidChangeTreeData: Event<InlineComment | undefined> = this._onDidChangeTreeData.event;
  
    refresh(comment?: InlineComment): void {
      this._onDidChangeTreeData.fire(comment);
    }
  
    getTreeItem(element: InlineComment): TreeItem {
      return element;
    } 
  
    async getChildren(element?: InlineComment): Promise<InlineComment[]> {
      const comments: InlineComment[] = [];
      const savedComments = await readFromFile("comments.json");
      savedComments.forEach((comment: { title: string; comment: string; }) => {
        const treeItemComment = new InlineComment(comment.title, comment.comment, TreeItemCollapsibleState.Collapsed);
        comments.push(treeItemComment);
      });
  
      return Promise.resolve(comments);
      // const items: InlineComment[] = [
      //   new InlineComment('Item 1', 'Test', TreeItemCollapsibleState.Collapsed),
      //   new InlineComment('Item 2', 'Test', TreeItemCollapsibleState.Collapsed),
      // ];
  
      // return Promise.resolve(items);
    }
  }