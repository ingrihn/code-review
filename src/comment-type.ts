export interface CommentType {
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