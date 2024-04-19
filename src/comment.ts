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
  priority?: number;
}

export interface GeneralComment {
  comment: string;
  rubricId: number;
  score?: number;
}
