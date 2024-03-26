export interface CommentType {
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