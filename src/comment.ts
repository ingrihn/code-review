export interface InlineComment {
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

export interface GeneralComment {
  id: number;
  comment: string;
  rubricId: number;
  score?: number;
}
